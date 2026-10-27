"""
Unit test for pure deterministic engine reproducing Round 1 Lumora caption findings.
"""
import json
import os
from app.engine.normalize import normalize_text
from app.engine.rules import evaluate_rules
from app.engine.facts import evaluate_facts

def load_seed_json(filename: str):
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    path = os.path.join(base_dir, "data", "seed", filename)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def test_lumora_sample_exact_reproduction():
    rules = load_seed_json("rules.json")
    facts = load_seed_json("facts.json")
    samples = load_seed_json("samples.json")

    lumora_draft = samples[0]["body"]
    assert "world's best" in lumora_draft
    assert "available across the US" in lumora_draft
    assert "revolutionary" in lumora_draft

    # Split facts into substantiations and facts
    substantiations = [f for f in facts if f.get("kind") == "substantiation"]
    general_facts = [f for f in facts if f.get("kind") != "substantiation"]

    # 1. Evaluate rules
    rule_findings = evaluate_rules(lumora_draft, rules, substantiations)

    # 2. Evaluate facts
    fact_findings = evaluate_facts(lumora_draft, general_facts)

    all_findings = rule_findings + fact_findings
    finding_evidence_ids = {f.evidence_id for f in all_findings}

    # Verify F-1 (CLAIM-01), F-2 (AF-014), and F-3 (TERM-03) all fired
    assert "CLAIM-01" in finding_evidence_ids, "Superlative 'world's best' must trigger CLAIM-01"
    assert "AF-014" in finding_evidence_ids, "US availability must trigger AF-014 contradiction"
    assert "TERM-03" in finding_evidence_ids, "Banned word 'revolutionary' must trigger TERM-03"

    # Verify substantiation suppression: "award-winning design" must NOT be flagged as unsupported claim
    award_findings = [f for f in all_findings if "award" in f.excerpt_text.lower()]
    assert len(award_findings) == 0, "Award-winning design should be suppressed by SUB-01 substantiation"

    # Check finding severities and verification statuses
    f_claim = next(f for f in all_findings if f.evidence_id == "CLAIM-01")
    assert f_claim.verification_status == "unsupported_claim"
    assert f_claim.severity == "high"
    assert f_claim.excerpt_text.lower() == "world's best"

    f_avail = next(f for f in all_findings if f.evidence_id == "AF-014")
    assert f_avail.verification_status == "confirmed_contradiction"
    assert f_avail.severity == "critical"
    assert "available across the us" in f_avail.excerpt_text.lower()

    f_term = next(f for f in all_findings if f.evidence_id == "TERM-03")
    assert f_term.verification_status == "style_issue"
    assert f_term.severity == "medium"
    assert f_term.excerpt_text.lower() == "revolutionary"

    # Verify offset integrity: slicing body at [start:end] must match excerpt_text exactly
    for f in all_findings:
        assert lumora_draft[f.start:f.end] == f.excerpt_text

def test_normalizer_offset_integrity():
    text_with_curly = '“Lumora” is ‘the’ best\u00a0lamp.'
    norm = normalize_text(text_with_curly)
    assert len(norm) == len(text_with_curly), "Normalized length must strictly equal original length"
    assert norm == '"Lumora" is \'the\' best lamp.'
