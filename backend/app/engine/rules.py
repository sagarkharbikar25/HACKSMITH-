"""
Deterministic rule evaluation engine for phrases, terminology, claims, and tone.
"""
import re
from typing import List, Dict, Any, Set
from .types import RawFinding
from .normalize import normalize_text

def evaluate_rules(
    body: str,
    rules: List[Dict[str, Any]],
    substantiations: List[Dict[str, Any]]
) -> List[RawFinding]:
    """
    Evaluates current rules against normalized body text.
    Suppresses claim violations if an approved substantiation covers the phrase.
    """
    findings: List[RawFinding] = []
    norm_body = normalize_text(body)

    # Build set of substantiated phrases/tags
    substantiated_phrases: Set[str] = set()
    for sub in substantiations:
        for tag in sub.get("tags", []):
            substantiated_phrases.add(tag.lower().strip())
        for alias in sub.get("aliases", []):
            substantiated_phrases.add(alias.lower().strip())

    for rule in rules:
        if rule.get("status") != "current":
            continue

        r_id = rule["id"]
        r_type = rule.get("type")
        severity = rule.get("severity", "medium")
        message = rule.get("message", "")
        suggestion = rule.get("suggestion")
        pattern_data = rule.get("pattern", {})

        # 1. PHRASE RULES (regex match)
        if r_type == "phrase":
            regex_str = pattern_data.get("regex")
            if regex_str:
                for match in re.finditer(regex_str, norm_body, re.IGNORECASE):
                    findings.append(
                        RawFinding(
                            category="terminology",
                            severity=severity,
                            start=match.start(),
                            end=match.end(),
                            excerpt_text=body[match.start():match.end()],
                            explanation=message,
                            evidence_id=r_id,
                            evidence_kind="rule",
                            suggestion=suggestion,
                            verification_status="style_issue",
                            source_engine="rules"
                        )
                    )

        # 2. TERMINOLOGY RULES (avoid vs prefer)
        elif r_type == "term":
            avoid_list = pattern_data.get("avoid", [])
            prefer_word = pattern_data.get("prefer", suggestion)
            for avoid in avoid_list:
                pattern = r"\b" + re.escape(avoid) + r"\b"
                for match in re.finditer(pattern, norm_body, re.IGNORECASE):
                    findings.append(
                        RawFinding(
                            category="terminology",
                            severity=severity,
                            start=match.start(),
                            end=match.end(),
                            excerpt_text=body[match.start():match.end()],
                            explanation=message or f"Avoid '{avoid}'; prefer '{prefer_word}'.",
                            evidence_id=r_id,
                            evidence_kind="rule",
                            suggestion=prefer_word,
                            verification_status="style_issue",
                            source_engine="rules"
                        )
                    )

        # 3. CLAIM RULES (superlatives, absolutes, comparatives)
        elif r_type == "claim":
            regex_str = pattern_data.get("regex")
            if regex_str:
                for match in re.finditer(regex_str, norm_body, re.IGNORECASE):
                    start, end = match.start(), match.end()
                    matched_text = body[start:end]

                    # Context window (sentence or 40 chars around match) to check for substantiation
                    window_start = max(0, start - 30)
                    window_end = min(len(norm_body), end + 30)
                    context_window = norm_body[window_start:window_end].lower()

                    # Check if any substantiation tag is mentioned in this context
                    is_substantiated = any(
                        phrase in context_window
                        for phrase in substantiated_phrases
                        if len(phrase) >= 3
                    )
                    if is_substantiated:
                        continue  # Suppressed by verified fact substantiation!

                    findings.append(
                        RawFinding(
                            category="claim",
                            severity=severity,
                            start=start,
                            end=end,
                            excerpt_text=matched_text,
                            explanation=message,
                            evidence_id=r_id,
                            evidence_kind="rule",
                            suggestion=suggestion,
                            verification_status="unsupported_claim",
                            source_engine="rules"
                        )
                    )

        # 4. TONE RULES
        elif r_type == "tone":
            regex_str = pattern_data.get("regex")
            if regex_str:
                for match in re.finditer(regex_str, norm_body):
                    findings.append(
                        RawFinding(
                            category="tone",
                            severity=severity,
                            start=match.start(),
                            end=match.end(),
                            excerpt_text=body[match.start():match.end()],
                            explanation=message,
                            evidence_id=r_id,
                            evidence_kind="rule",
                            suggestion=suggestion,
                            verification_status="style_issue",
                            source_engine="rules"
                        )
                    )

    return findings
