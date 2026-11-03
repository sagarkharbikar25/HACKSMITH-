"""
SQLAlchemy ORM models strictly implementing Round 2 and Round 3 specifications.
"""
from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime, Date,
    ForeignKey, JSON, LargeBinary, UniqueConstraint, Index, func
)
from sqlalchemy.orm import relationship
from .config import settings
from .db import Base

try:
    from pgvector.sqlalchemy import Vector
    EmbVector = Vector(settings.EMBEDDING_DIM).with_variant(JSON, "sqlite")
except (ImportError, ModuleNotFoundError):
    EmbVector = JSON

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)  # creator, agency, reviewer, brand_manager, admin
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    submissions = relationship("Submission", back_populates="author")

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(String(100), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User")

class Rule(Base):
    __tablename__ = "rules"

    id = Column(String(50), primary_key=True)  # e.g. "TERM-01", "CLAIM-01", "VIS-01", "ACC-01"
    type = Column(String(50), nullable=False)  # term, phrase, claim, tone, palette, contrast
    pattern = Column(JSON, nullable=False)
    severity = Column(String(20), nullable=False)  # critical, high, medium, low
    message = Column(Text, nullable=False)
    suggestion = Column(String(255), nullable=True)
    tags = Column(JSON, default=list)
    status = Column(String(20), default="current")  # current, retired
    last_reviewed = Column(Date, default=date.today)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Round 3 additive fields
    source_citation = Column(String(255), nullable=True)
    source_document_id = Column(Integer, nullable=True)
    source_page = Column(Integer, nullable=True)
    previous_wording = Column(JSON, nullable=True)

class Fact(Base):
    __tablename__ = "facts"

    id = Column(String(50), primary_key=True)  # e.g. "AF-014", "SUB-01"
    topic = Column(String(100), nullable=False)
    subject = Column(String(100), nullable=False)
    aliases = Column(JSON, default=list)
    statement = Column(Text, nullable=False)
    structured_value = Column(JSON, default=dict)
    valid_from = Column(Date, default=date.today)
    last_reviewed = Column(Date, default=date.today)
    status = Column(String(20), default="current")  # current, outdated, retired
    tags = Column(JSON, default=list)
    kind = Column(String(30), default="fact")  # fact, substantiation

    # Round 3 additive fields
    source_citation = Column(String(255), nullable=True)
    source_document_id = Column(Integer, nullable=True)
    source_page = Column(Integer, nullable=True)

class Asset(Base):
    __tablename__ = "assets"

    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    usage_note = Column(Text, nullable=True)
    required_alt_text = Column(String(255), nullable=True)

class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    content_type = Column(String(50), default="social")  # social, email, web, press
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(50), default="draft")  # draft, in_review, approved, revision_requested
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    author = relationship("User", back_populates="submissions")
    versions = relationship("Version", back_populates="submission", cascade="all, delete-orphan", order_by="Version.number")
    reviews = relationship("Review", back_populates="submission", cascade="all, delete-orphan", order_by="Review.created_at")
    comments = relationship("Comment", back_populates="submission", cascade="all, delete-orphan", order_by="Comment.created_at")
    creative_assets = relationship("CreativeAsset", back_populates="submission", cascade="all, delete-orphan")
    asset_findings = relationship("AssetFinding", back_populates="submission", cascade="all, delete-orphan")

class Version(Base):
    __tablename__ = "versions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    number = Column(Integer, nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    engines = Column(JSON, default=lambda: {"rules": "ran", "llm": "disabled", "semantic": "disabled"})
    engines_semantic = Column(String(16), nullable=True)

    submission = relationship("Submission", back_populates="versions")
    findings = relationship("Finding", back_populates="version", cascade="all, delete-orphan", order_by="Finding.start")

class Finding(Base):
    __tablename__ = "findings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    version_id = Column(Integer, ForeignKey("versions.id"), nullable=False)
    issue_id = Column(String(20), nullable=False)  # "F-1", "F-2"
    category = Column(String(50), nullable=False)  # terminology, factual, claim, tone, accessibility, visual
    severity = Column(String(20), nullable=False)  # critical, high, medium, low
    start = Column(Integer, nullable=False)
    end = Column(Integer, nullable=False)
    excerpt_text = Column(String(255), nullable=False)
    explanation = Column(Text, nullable=False)
    evidence_id = Column(String(50), nullable=False)
    evidence_kind = Column(String(20), nullable=False)  # rule, fact
    suggestion = Column(String(255), nullable=True)
    verification_status = Column(String(50), nullable=False)  # confirmed_contradiction, unsupported_claim, style_issue, needs_human_verification
    source_engine = Column(String(20), default="rules")  # rules, llm, semantic
    resolution = Column(String(20), default="open")  # open, accepted, edited, dismissed
    resolution_reason = Column(Text, nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    # Round 3 additive fields
    similarity = Column(Float, nullable=True)
    match_type = Column(String(16), default="exact")

    version = relationship("Version", back_populates="findings")

class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    version_id = Column(Integer, ForeignKey("versions.id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    decision = Column(String(50), nullable=False)  # approve, request_revision
    comment = Column(Text, nullable=False)
    override_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    submission = relationship("Submission", back_populates="reviews")
    reviewer = relationship("User")

class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    submission = relationship("Submission", back_populates="comments")
    author = relationship("User")

class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    object_type = Column(String(50), nullable=False)
    object_id = Column(String(100), nullable=True)
    meta = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    actor = relationship("User")

# ==========================================
# ROUND 3 NEW MODELS
# ==========================================

class GuidelineDocument(Base):
    __tablename__ = "guideline_documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(200), nullable=False)  # "Brand Book 2026"
    filename = Column(String(255), nullable=False)
    mime = Column(String(100), nullable=False)
    sha256 = Column(String(64), index=True, nullable=False)
    page_count = Column(Integer, nullable=True)
    status = Column(String(16), nullable=False, default="queued")  # queued|parsing|extracting|ready|partial|failed
    stage = Column(String(40), default="queued")  # human progress status
    error_code = Column(String(40), nullable=True)
    error_message = Column(String(300), nullable=True)
    generator = Column(String(12), nullable=True)  # ai | heuristic
    chunks_total = Column(Integer, default=0)
    chunks_done = Column(Integer, default=0)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)

    uploader = relationship("User")
    proposals = relationship("PendingGuidelineProposal", back_populates="document", cascade="all, delete-orphan")

class PendingGuidelineProposal(Base):
    __tablename__ = "pending_guideline_proposals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(Integer, ForeignKey("guideline_documents.id", ondelete="CASCADE"), index=True, nullable=False)
    proposal_type = Column(String(8), nullable=False)  # rule | fact
    payload = Column(JSON, nullable=False)  # validates against RuleCreate | FactCreate
    source_page = Column(Integer, nullable=True)
    source_section = Column(String(200), nullable=True)
    source_excerpt = Column(Text, nullable=False)
    citation = Column(String(300), nullable=False)  # "Brand Book 2026, Page 14"
    extraction_confidence = Column(String(8), default="medium")  # high|medium|low
    duplicate_of = Column(String(40), nullable=True)
    conflicts_with = Column(String(40), nullable=True)
    status = Column(String(16), nullable=False, default="pending", index=True)  # pending|accepted|rejected
    decision_note = Column(String(500), nullable=True)
    reject_reason = Column(String(30), nullable=True)
    edited = Column(Boolean, default=False)
    published_id = Column(String(40), nullable=True)
    decided_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    decided_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("GuidelineDocument", back_populates="proposals")
    decider = relationship("User")

class CreativeAsset(Base):
    __tablename__ = "creative_assets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    submission_id = Column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), index=True, nullable=False)
    version_id = Column(Integer, ForeignKey("versions.id"), nullable=True)
    filename = Column(String(255), nullable=False)
    mime = Column(String(40), nullable=False)
    width = Column(Integer, nullable=False)
    height = Column(Integer, nullable=False)
    size_bytes = Column(Integer, nullable=False)
    sha256 = Column(String(64), index=True)
    data = Column(LargeBinary, nullable=False)  # Re-encoded, EXIF stripped
    active = Column(Boolean, default=True, index=True)
    engines = Column(JSON, default=dict)
    analysis = Column(JSON, default=dict)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    submission = relationship("Submission", back_populates="creative_assets")
    uploader = relationship("User")
    findings = relationship("AssetFinding", back_populates="asset", cascade="all, delete-orphan")

class AssetFinding(Base):
    __tablename__ = "asset_findings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    asset_id = Column(Integer, ForeignKey("creative_assets.id", ondelete="CASCADE"), index=True, nullable=False)
    submission_id = Column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), index=True, nullable=False)
    issue_id = Column(String(10), nullable=False)  # V-1, V-2 …
    check_type = Column(String(12), nullable=False)  # palette | contrast
    category = Column(String(16), nullable=False)  # visual | accessibility
    severity = Column(String(8), nullable=False)  # critical | high | medium | low
    bbox_x = Column(Float, nullable=False)
    bbox_y = Column(Float, nullable=False)
    bbox_w = Column(Float, nullable=False)
    bbox_h = Column(Float, nullable=False)
    measured = Column(JSON, nullable=False)
    explanation = Column(Text, nullable=False)
    evidence_id = Column(String(40), nullable=False)
    evidence_kind = Column(String(8), default="rule")
    suggested_correction = Column(String(300), nullable=True)
    verification_status = Column(String(32), nullable=False)
    source_engine = Column(String(8), default="vision")
    resolution = Column(String(10), default="open")  # open|accepted|edited|dismissed
    resolution_reason = Column(String(500), nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    asset = relationship("CreativeAsset", back_populates="findings")
    submission = relationship("Submission", back_populates="asset_findings")
    resolver = relationship("User")

class Embedding(Base):
    __tablename__ = "embeddings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_type = Column(String(8), nullable=False)  # rule | fact
    owner_id = Column(String(40), nullable=False, index=True)
    facet_key = Column(String(120), nullable=False)
    source_text = Column(Text, nullable=False)
    text_hash = Column(String(64), nullable=False)
    model = Column(String(60), nullable=False)
    vector = Column(EmbVector, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("owner_type", "owner_id", "facet_key", "model", name="uq_emb_facet"),
    )

class RuleWordingSuggestion(Base):
    __tablename__ = "rule_wording_suggestions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    rule_id = Column(String(40), index=True, nullable=False)
    input_hash = Column(String(64), nullable=False)
    stats = Column(JSON, nullable=False)
    clusters = Column(JSON, nullable=False)
    current_wording = Column(JSON, nullable=False)
    proposed_wording = Column(JSON, nullable=False)
    rationale = Column(Text, nullable=False)
    generator = Column(String(12), nullable=False)  # ai | heuristic
    status = Column(String(10), nullable=False, default="pending")  # pending|adopted|dismissed|undone|stale
    decided_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    decided_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    decider = relationship("User")
    __table_args__ = (
        Index("ix_gap_rule_status", "rule_id", "status"),
    )
