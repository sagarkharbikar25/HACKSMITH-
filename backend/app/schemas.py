"""
Pydantic v2 schemas defining the API contract (Contract v3 for Round 3).
"""
from typing import Optional, List, Dict, Any, Literal, Union
from datetime import datetime, date
from pydantic import BaseModel, Field, field_validator, model_validator

# --- Authentication ---
class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: Literal["creator", "agency", "reviewer", "brand_manager", "admin"] = "creator"

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}

class TokenResponse(BaseModel):
    token: str
    user: UserOut

class ForgotPasswordRequest(BaseModel):
    email: str

class ForgotPasswordResponse(BaseModel):
    message: str
    reset_token: Optional[str] = None
    expires_in_minutes: int = 15

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=6, max_length=128)

class ResetPasswordResponse(BaseModel):
    message: str

# --- Knowledge & Evidence ---
class SourceInfo(BaseModel):
    citation: str
    page: Optional[int] = None
    document_id: Optional[int] = None

class EvidenceRef(BaseModel):
    id: str
    kind: str
    label: str
    last_reviewed: Optional[str] = None
    source: Optional[SourceInfo] = None

class RuleCreate(BaseModel):
    id: Optional[str] = None
    type: str  # term, phrase, claim, tone, palette, contrast
    pattern: Dict[str, Any] = {}
    severity: Literal["critical", "high", "medium", "low"] = "medium"
    message: str
    suggestion: Optional[str] = None
    tags: List[str] = []

class FactCreate(BaseModel):
    id: Optional[str] = None
    topic: str
    subject: str
    aliases: List[str] = []
    statement: str
    structured_value: Dict[str, Any] = {}
    valid_from: Optional[date] = None
    status: str = "current"
    tags: List[str] = []
    kind: str = "fact"

class RuleOut(BaseModel):
    id: str
    type: str
    pattern: Dict[str, Any]
    severity: str
    message: str
    suggestion: Optional[str] = None
    tags: List[str] = []
    status: str
    last_reviewed: Optional[date] = None
    source_citation: Optional[str] = None
    source_document_id: Optional[int] = None
    source_page: Optional[int] = None

    model_config = {"from_attributes": True}

class FactOut(BaseModel):
    id: str
    topic: str
    subject: str
    aliases: List[str] = []
    statement: str
    structured_value: Dict[str, Any] = {}
    valid_from: Optional[date] = None
    last_reviewed: Optional[date] = None
    status: str
    tags: List[str] = []
    kind: str
    source_citation: Optional[str] = None
    source_document_id: Optional[int] = None
    source_page: Optional[int] = None

    model_config = {"from_attributes": True}

# --- Finding & Audit ---
class Excerpt(BaseModel):
    text: str
    start: int
    end: int

class FindingOut(BaseModel):
    id: int
    issue_id: str
    version_id: int
    category: str
    severity: str
    excerpt: Excerpt
    explanation: str
    evidence: EvidenceRef
    suggested_correction: Optional[str] = None
    verification_status: str
    source_engine: Literal["rules", "llm", "semantic"] = "rules"
    resolution: str
    resolution_reason: Optional[str] = None
    similarity: Optional[float] = None
    match_type: Literal["exact", "semantic"] = "exact"

class FindingPatchRequest(BaseModel):
    resolution: Literal["accepted", "edited", "dismissed"]
    reason: Optional[str] = None

class AuditSummary(BaseModel):
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
    total: int = 0

class AuditEngines(BaseModel):
    rules: str = "ran"
    llm: str = "disabled"  # ran, disabled, unavailable, discarded
    llm_reason: Optional[str] = None
    semantic: Literal["ran", "disabled", "unavailable"] = "disabled"
    semantic_reason: Optional[str] = None

class AuditResultOut(BaseModel):
    submission_id: int
    version_id: int
    version: int
    engines: AuditEngines
    summary: AuditSummary
    findings: List[FindingOut]

# ==========================================
# ROUND 3 SCHEMAS
# ==========================================

# --- Ingestion & Proposals ---
class SourceRef(BaseModel):
    document_id: int
    document_title: str
    page: Optional[int] = None
    section: Optional[str] = None
    citation: str                      # "Brand Book 2026, Page 14"
    excerpt: str                       # verbatim excerpt

class DocumentOut(BaseModel):
    id: int
    title: str
    filename: str
    mime: str
    page_count: Optional[int] = None
    status: Literal["queued", "parsing", "extracting", "ready", "partial", "failed"]
    stage: str
    chunks_total: int = 0
    chunks_done: int = 0
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    generator: Optional[str] = "ai"
    proposal_counts: Dict[str, int] = {}
    uploaded_by: str
    created_at: datetime
    finished_at: Optional[datetime] = None

class ProposalOut(BaseModel):
    id: int
    document_id: int
    proposal_type: Literal["rule", "fact"]
    payload: Dict[str, Any]
    source: SourceRef
    extraction_confidence: Literal["high", "medium", "low"] = "medium"
    duplicate_of: Optional[str] = None
    conflicts_with: Optional[str] = None
    status: Literal["pending", "accepted", "rejected"] = "pending"
    edited: bool = False
    decision_note: Optional[str] = None
    reject_reason: Optional[str] = None
    published_id: Optional[str] = None
    decided_by: Optional[str] = None
    decided_at: Optional[datetime] = None
    created_at: datetime

    @field_validator("extraction_confidence", mode="before")
    @classmethod
    def normalize_confidence(cls, v: Any) -> str:
        if isinstance(v, (int, float)):
            return "high" if v >= 0.8 else ("medium" if v >= 0.5 else "low")
        if isinstance(v, str):
            try:
                num = float(v)
                return "high" if num >= 0.8 else ("medium" if num >= 0.5 else "low")
            except ValueError:
                lower = v.lower()
                return lower if lower in ("high", "medium", "low") else "medium"
        return "medium"

class AcceptProposalIn(BaseModel):
    payload: Optional[Dict[str, Any]] = None
    note: Optional[str] = Field(None, max_length=500)

class RejectProposalIn(BaseModel):
    reason: Literal["not_a_rule", "duplicate", "incorrect_extraction", "out_of_scope", "other"]
    note: Optional[str] = Field(None, max_length=500)

# --- Creative Assets & Visual Compliance ---
class BBox(BaseModel):
    x: float = Field(ge=0.0, le=1.0)
    y: float = Field(ge=0.0, le=1.0)
    w: float = Field(gt=0.0, le=1.0)
    h: float = Field(gt=0.0, le=1.0)

class PaletteColorOut(BaseModel):
    name: str
    hex: str
    role: Literal["primary", "secondary", "accent", "neutral"]

class SwatchOut(BaseModel):
    hex: str
    share: float
    nearest_hex: Optional[str] = None
    nearest_name: Optional[str] = None
    delta_e: Optional[float] = None
    status: Literal["on_palette", "off_palette", "neutral_allowed", "minor"]

class PaletteMeasured(BaseModel):
    kind: Literal["palette"] = "palette"
    found_hex: str
    found_share: float
    nearest_hex: str
    nearest_name: str
    delta_e: float
    max_delta_e: float

class ContrastMeasured(BaseModel):
    kind: Literal["contrast"] = "contrast"
    foreground_hex: str
    background_hex: str
    ratio: float
    required_ratio: float
    worst_case_ratio: Optional[float] = None
    busy_background: bool = False
    text_sample: str

class AssetFindingOut(BaseModel):
    id: int
    issue_id: str
    asset_id: int
    check_type: Literal["palette", "contrast"]
    category: Literal["visual", "accessibility"]
    severity: Literal["critical", "high", "medium", "low"]
    bbox: BBox
    measured: Union[PaletteMeasured, ContrastMeasured] = Field(discriminator="kind")
    explanation: str
    evidence: EvidenceRef
    suggested_correction: Optional[str] = None
    verification_status: Literal["confirmed_contradiction", "unsupported_claim", "style_issue", "needs_human_verification"]
    source_engine: Literal["vision"] = "vision"
    resolution: Literal["open", "accepted", "edited", "dismissed"] = "open"
    resolution_reason: Optional[str] = None

class AssetEngines(BaseModel):
    palette: Literal["ran", "disabled"] = "ran"
    contrast: Literal["ran", "unavailable", "disabled"] = "ran"
    contrast_reason: Optional[str] = None
    text_detector: Literal["gemini", "mock", "none"] = "mock"

class AssetOut(BaseModel):
    id: int
    submission_id: int
    version_id: Optional[int] = None
    filename: str
    mime: str
    width: int
    height: int
    size_bytes: int
    active: bool = True
    created_at: datetime
    engines: AssetEngines = AssetEngines()
    dominant_colors: List[SwatchOut] = []
    brand_palette: List[PaletteColorOut] = []
    summary: Dict[str, int] = {}
    findings: List[AssetFindingOut] = []

class ResolveAssetFindingIn(BaseModel):
    resolution: Literal["accepted", "edited", "dismissed"]
    reason: Optional[str] = Field(None, max_length=500)

# --- Submissions & Versions with Assets ---
class SubmissionCreate(BaseModel):
    title: str
    content_type: str = "social"
    body: str

class VersionCreate(BaseModel):
    body: str

class VersionOut(BaseModel):
    id: int
    submission_id: int
    number: int
    body: str
    engines: Dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}

class ReviewOut(BaseModel):
    id: int
    submission_id: int
    version_id: int
    reviewer_id: int
    decision: str
    comment: str
    override_reason: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}

class CommentOut(BaseModel):
    id: int
    submission_id: int
    author_id: int
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}

class CommentCreate(BaseModel):
    body: str

class SubmissionOut(BaseModel):
    id: int
    title: str
    content_type: str
    author_id: int
    status: str
    created_at: datetime
    updated_at: datetime
    latest_version: Optional[int] = None
    open_findings_count: Optional[int] = 0

    model_config = {"from_attributes": True}

class SubmissionDetailOut(BaseModel):
    id: int
    title: str
    content_type: str
    author_id: int
    status: str
    created_at: datetime
    updated_at: datetime
    versions: List[VersionOut] = []
    latest_findings: List[FindingOut] = []
    reviews: List[ReviewOut] = []
    comments: List[CommentOut] = []
    assets: List[AssetOut] = []

    model_config = {"from_attributes": True}

class DecisionRequest(BaseModel):
    decision: Literal["approve", "request_revision"]
    comment: str
    override_reason: Optional[str] = None

# --- Guideline-Gap Analytics ---
class GapCluster(BaseModel):
    label: str
    count: int = 1
    examples: List[str] = []
    reasons: List[str] = []

    @model_validator(mode="before")
    @classmethod
    def map_cluster_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            mapped = dict(data)
            if "label" not in mapped and "theme" in mapped:
                mapped["label"] = mapped.pop("theme")
            if "count" not in mapped and "size" in mapped:
                mapped["count"] = mapped.pop("size")
            if "examples" not in mapped and "exemplars" in mapped:
                mapped["examples"] = mapped.pop("exemplars")
            if "reasons" not in mapped and "common_rationales" in mapped:
                mapped["reasons"] = mapped.pop("common_rationales")
            if "label" not in mapped:
                mapped["label"] = "Disputed Pattern"
            if "count" not in mapped:
                mapped["count"] = len(mapped.get("examples", [])) or 1
            return mapped
        return data

class RuleWording(BaseModel):
    message: str
    suggestion: Optional[str] = None
    patterns: Dict[str, Any] = {}
    added_exceptions: List[str] = []

    model_config = {"extra": "ignore"}

class GapSuggestionOut(BaseModel):
    id: int
    rule_id: str
    rule_label: str
    stats: Dict[str, Any] = {}
    clusters: List[GapCluster] = []
    current_wording: RuleWording
    proposed_wording: RuleWording
    rationale: str
    generator: Literal["ai", "heuristic"] = "ai"
    status: Literal["pending", "adopted", "dismissed", "undone", "stale"] = "pending"
    created_at: datetime

class AdoptWordingIn(BaseModel):
    proposed_wording: Optional[RuleWording] = None

# --- Insights ---
class RuleInsight(BaseModel):
    evidence_id: str
    label: str
    fired: int
    dismissed: int
    overridden: int
    dismissal_rate: float
    flag: Optional[str] = None

class InsightsOut(BaseModel):
    totals: Dict[str, int]
    rules: List[RuleInsight]
    by_category: Dict[str, int]

# --- Admin Audit Log ---
class AuditLogOut(BaseModel):
    id: int
    actor_id: Optional[int] = None
    action: str
    object_type: str
    object_id: Optional[str] = None
    meta: Dict[str, Any] = {}
    created_at: datetime

    model_config = {"from_attributes": True}
