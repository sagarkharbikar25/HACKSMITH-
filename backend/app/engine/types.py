from dataclasses import dataclass
from typing import Literal, Optional, List, Set, Dict, Any

@dataclass
class RawFinding:
    category: str
    severity: str
    start: int
    end: int
    excerpt_text: str
    explanation: str
    evidence_id: str
    evidence_kind: str  # "rule" | "fact"
    suggestion: Optional[str]
    verification_status: str  # "confirmed_contradiction" | "unsupported_claim" | "style_issue" | "needs_human_verification"
    source_engine: str  # "rules" | "llm"

@dataclass
class ContextPack:
    rules: List[Dict[str, Any]]
    facts: List[Dict[str, Any]]
    ids: Set[str]

@dataclass
class LLMResult:
    status: Literal["ran", "disabled", "unavailable", "discarded"]
    reason: Optional[str]
    findings: List[RawFinding]
