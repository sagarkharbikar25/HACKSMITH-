"""
SQLAlchemy ORM models strictly implementing Section 4 of 02_PROTOTYPE_BUILD_PLAN.md.
"""
from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Date, ForeignKey, JSON, Enum
)
from sqlalchemy.orm import relationship
from .db import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)  # creator, agency, reviewer, brand_manager, admin
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    submissions = relationship("Submission", back_populates="author")

class Rule(Base):
    __tablename__ = "rules"

    id = Column(String(50), primary_key=True)  # e.g. "TERM-01", "CLAIM-01"
    type = Column(String(50), nullable=False)  # term, phrase, claim, tone
    pattern = Column(JSON, nullable=False)
    severity = Column(String(20), nullable=False)  # critical, high, medium, low
    message = Column(Text, nullable=False)
    suggestion = Column(String(255), nullable=True)
    tags = Column(JSON, default=list)
    status = Column(String(20), default="current")  # current, retired
    last_reviewed = Column(Date, default=date.today)
    created_at = Column(DateTime, default=datetime.utcnow)

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

class Version(Base):
    __tablename__ = "versions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    number = Column(Integer, nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    engines = Column(JSON, default=lambda: {"rules": "ran", "llm": "disabled"})

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
    source_engine = Column(String(20), default="rules")  # rules, llm
    resolution = Column(String(20), default="open")  # open, accepted, edited, dismissed
    resolution_reason = Column(Text, nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)

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
