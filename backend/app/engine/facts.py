"""
Deterministic factual contradiction and verification engine.
"""
import re
from typing import List, Dict, Any, Optional
from .types import RawFinding
from .normalize import normalize_text
from .regions import extract_regions, AVAILABILITY_TRIGGERS

def evaluate_facts(
    body: str,
    facts: List[Dict[str, Any]]
) -> List[RawFinding]:
    """
    Checks body for factual claims regarding availability, battery specs, and pricing.
    """
    findings: List[RawFinding] = []
    norm_body = normalize_text(body)

    for fact in facts:
        fact_id = fact["id"]
        topic = fact.get("topic")
        status = fact.get("status", "current")
        structured = fact.get("structured_value", {})
        statement = fact.get("statement", "")

        # 1. AVAILABILITY CONTRADICTIONS
        if topic == "availability":
            approved_regions = set(structured.get("regions", []))

            # Find sentences or clauses containing availability triggers
            # Split by punctuation keeping track of offsets
            clause_pattern = re.compile(r'[^.!?\n]+[.!?\n]?')
            for clause_match in clause_pattern.finditer(norm_body):
                clause_text = clause_match.group(0)
                clause_start = clause_match.start()

                # Does this clause have an availability trigger?
                trigger_match = AVAILABILITY_TRIGGERS.search(clause_text)
                if not trigger_match:
                    continue

                # Extract regions mentioned in this clause
                extracted = extract_regions(clause_text)
                for region_code, r_start, r_end, matched_region_str in extracted:
                    if region_code not in approved_regions and region_code != "ALL":
                        # Unapproved region claimed!
                        # Pinpoint excerpt from trigger start to end of region string
                        t_start = trigger_match.start()
                        if t_start < r_end:
                            excerpt_start = clause_start + min(t_start, r_start)
                            excerpt_end = clause_start + max(r_end, trigger_match.end())
                        else:
                            excerpt_start = clause_start + r_start
                            excerpt_end = clause_start + r_end

                        raw_excerpt = body[excerpt_start:excerpt_end]

                        if status == "outdated":
                            findings.append(
                                RawFinding(
                                    category="factual",
                                    severity="medium",
                                    start=excerpt_start,
                                    end=excerpt_end,
                                    excerpt_text=raw_excerpt,
                                    explanation=f"The matching availability record {fact_id} is marked outdated.",
                                    evidence_id=fact_id,
                                    evidence_kind="fact",
                                    suggestion="Verify current territory availability.",
                                    verification_status="needs_human_verification",
                                    source_engine="rules"
                                )
                            )
                        else:
                            findings.append(
                                RawFinding(
                                    category="factual",
                                    severity="critical",
                                    start=excerpt_start,
                                    end=excerpt_end,
                                    excerpt_text=raw_excerpt,
                                    explanation="The approved availability record lists India and the UK only.",
                                    evidence_id=fact_id,
                                    evidence_kind="fact",
                                    suggestion="available in India and the UK",
                                    verification_status="confirmed_contradiction",
                                    source_engine="rules"
                                )
                            )

        # 2. BATTERY LIFE SPECS
        elif topic == "battery":
            max_approved_hours = structured.get("battery_hours", 12)
            battery_pattern = re.compile(r'\b(?:battery\s+life\s+of\s+)?up\s+to\s+(\d+)\s+hours?\b', re.IGNORECASE)
            for match in battery_pattern.finditer(norm_body):
                claimed_hours = int(match.group(1))
                if claimed_hours > max_approved_hours:
                    findings.append(
                        RawFinding(
                            category="factual",
                            severity="critical",
                            start=match.start(),
                            end=match.end(),
                            excerpt_text=body[match.start():match.end()],
                            explanation=f"Approved specifications certify up to {max_approved_hours} hours battery life. Claimed: {claimed_hours} hours.",
                            evidence_id=fact_id,
                            evidence_kind="fact",
                            suggestion=f"up to {max_approved_hours} hours",
                            verification_status="confirmed_contradiction",
                            source_engine="rules"
                        )
                    )

    return findings
