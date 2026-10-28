"""
Pydantic v2 schemas defining the API contract.
"""
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime, date
from pydantic import BaseModel, Field

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

# --- Finding & Audit ---
class Excerpt(BaseModel):
    text: str
    start: int
    end: int

class EvidenceRef(BaseModel):
    id: str
    kind: str
    label: str
    last_reviewed: Optional[str] = None

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
    source_engine: str
    resolution: str
    resolution_reason: Optional[str] = None

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

class AuditResultOut(BaseModel):
    submission_id: int
    version_id: int
    version: int
    engines: AuditEngines
    summary: AuditSummary
    findings: List[FindingOut]

# --- Submissions & Versions ---
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
    versions: List[VersionOut]
    latest_findings: List[FindingOut] = []
    reviews: List[ReviewOut] = []
    comments: List[CommentOut] = []

    model_config = {"from_attributes": True}

class DecisionRequest(BaseModel):
    decision: Literal["approve", "request_revision"]
    comment: str
    override_reason: Optional[str] = None

# --- Knowledge & Evidence ---
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

    model_config = {"from_attributes": True}

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
