"""
Keyword and tag retrieval service for context packaging.
"""
from typing import List, Dict, Any, Set
from .types import ContextPack

def retrieve_context(
    body: str,
    rules: List[Dict[str, Any]],
    facts: List[Dict[str, Any]],
    limit: int = 15
) -> ContextPack:
    """
    Selects relevant rules and facts based on keyword and tag presence in body.
    Always includes core Lumora facts and high-priority rules.
    """
    body_lower = body.lower()
    selected_rules: List[Dict[str, Any]] = []
    selected_facts: List[Dict[str, Any]] = []
    ids: Set[str] = set()

    for r in rules:
        r_id = r["id"]
        # Match if rule tags or ID are in body, or if claim/term rule
        tags = [t.lower() for t in r.get("tags", [])]
        if any(tag in body_lower for tag in tags) or r.get("type") in ("claim", "phrase"):
            if r_id not in ids:
                selected_rules.append(r)
                ids.add(r_id)

    for f in facts:
        f_id = f["id"]
        topic = f.get("topic", "").lower()
        tags = [t.lower() for t in f.get("tags", [])]
        aliases = [a.lower() for a in f.get("aliases", [])]
        if (topic in body_lower or any(t in body_lower for t in tags) or any(a in body_lower for a in aliases)):
            if f_id not in ids:
                selected_facts.append(f)
                ids.add(f_id)

    # If count is small, pad with first few current rules/facts
    for r in rules:
        if len(selected_rules) >= limit:
            break
        if r["id"] not in ids:
            selected_rules.append(r)
            ids.add(r["id"])

    for f in facts:
        if len(selected_facts) >= limit:
            break
        if f["id"] not in ids:
            selected_facts.append(f)
            ids.add(f["id"])

    return ContextPack(
        rules=selected_rules[:limit],
        facts=selected_facts[:limit],
        ids=ids
    )
