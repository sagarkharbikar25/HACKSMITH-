"""
Wording refinement engine for guideline gaps:
Suggests narrower, unambiguous rule phrasing and exceptions based on clusters of dismissed findings.
"""
import json
from typing import List, Dict, Any, Optional
from ..models import Rule
from ..config import settings
from ..services.knowledge_service import validate_patterns
from ..schemas import RuleCreate

def propose(rule: Rule, clusters: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Calls Gemini to refine rule wording based on dismissal clusters.
    Falls back to heuristic if disabled or on failure.
    """
    if not settings.LLM_ENABLED:
        return heuristic(rule, clusters)

    try:
        from .gemini_client import generate_json
        cluster_summary = []
        for c in clusters:
            cluster_summary.append({
                "label": c.get("label"),
                "count": c.get("count"),
                "examples": c.get("examples", [])[:3],
                "reasons": c.get("reasons", [])[:3]
            })

        prompt = (
            f"You are a brand compliance specialist refining an over-broad guideline rule.\n"
            f"Rule ID: {rule.id}\n"
            f"Current Message: {rule.message}\n"
            f"Current Suggestion: {rule.suggestion}\n"
            f"Current Pattern: {json.dumps(rule.pattern or {})}\n\n"
            f"Reviewers frequently dismissed findings from this rule under these recurring contexts:\n"
            f"{json.dumps(cluster_summary, indent=2)}\n\n"
            f"Provide a narrower, clear rule wording that prevents these false positives while preserving the core brand guardrail.\n"
            f"Return JSON strictly matching this schema:\n"
            f"{{\n"
            f'  "message": "Narrowed rule message",\n'
            f'  "suggestion": "Clear suggestion",\n'
            f'  "patterns": {json.dumps(rule.pattern or {})},\n'
            f'  "added_exceptions": ["phrase1", "phrase2"],\n'
            f'  "rationale": "Clear explanation of the refinement"\n'
            f"}}"
        )
        res = generate_json(prompt)
        # Validate patterns
        patterns = res.get("patterns", rule.pattern or {})
        obj = RuleCreate(type=rule.type, pattern=patterns, message=res.get("message", rule.message))
        validate_patterns(obj)
        return {
            "message": res.get("message", rule.message),
            "suggestion": res.get("suggestion", rule.suggestion),
            "patterns": patterns,
            "added_exceptions": res.get("added_exceptions", []),
            "rationale": res.get("rationale", "Refined via AI gap analysis.")
        }
    except Exception:
        return heuristic(rule, clusters)

def heuristic(rule: Rule, clusters: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Deterministic rule wording refiner based on cluster labels and dismissal reasons.
    """
    exceptions = []
    for c in clusters:
        label = c.get("label", "").strip()
        if label and label.lower() not in [e.lower() for e in exceptions]:
            exceptions.append(label)

    if not exceptions:
        exceptions = ["approved technical contexts", "industry-standard phrases"]

    exc_str = ", ".join(f'"{e}"' for e in exceptions[:3])
    base_msg = rule.message.rstrip(".")
    new_message = f"{base_msg}. Does not apply to legitimate usage such as: {exc_str}."

    return {
        "message": new_message,
        "suggestion": rule.suggestion or "Substantiate claim or use approved wording.",
        "patterns": rule.pattern or {},
        "added_exceptions": exceptions[:3],
        "rationale": f"Rule narrowed based on {len(clusters)} recurring dismissal clusters to prevent false alarms on acceptable terminology."
    }

