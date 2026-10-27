"""
Evidence resolver for UI inspection drawers and audit trails.
"""
from typing import Dict, Any, Optional

def resolve_evidence(
    evidence_id: str,
    rules_by_id: Dict[str, Dict[str, Any]],
    facts_by_id: Dict[str, Dict[str, Any]],
    is_agency: bool = False
) -> Optional[Dict[str, Any]]:
    """
    Returns full stored record for evidence drawer. Redacts confidential statement for agency role.
    """
    if evidence_id in facts_by_id:
        fact = dict(facts_by_id[evidence_id])
        fact["kind"] = fact.get("kind", "fact")
        if is_agency and fact.get("kind") != "substantiation":
            # Agency redaction per Round 1 requirement
            fact["statement"] = "[REDACTED: Confidential internal product fact statement. Contact brand manager.]"
        return fact

    if evidence_id in rules_by_id:
        rule = dict(rules_by_id[evidence_id])
        rule["kind"] = "rule"
        return rule

    return None
