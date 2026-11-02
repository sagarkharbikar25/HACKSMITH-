"""
Tests for sentence span extraction, semantic matcher accuracy, and error resilience.
"""
import pytest
from app.services.semantic_matcher import sentence_spans, run_semantic
from app.services.embedding_service import index_record
from app.db import Base, engine, SessionLocal
from app.seed import seed_database
from app.config import settings

def test_sentence_spans_code_points():
    text = "Lumora is bright! It illuminates your workspace. Experience it today."
    spans = sentence_spans(text, max_n=10)
    assert len(spans) == 3
    for s, e in spans:
        sentence = text[s:e]
        assert len(sentence) >= 12
        assert not sentence.startswith(" ")
        assert not sentence.endswith(" ")

def test_semantic_matcher_catches_paraphrase():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db, force_reset=True)
    index_record(db, "rule", "CLAIM-01")

    orig_flag = settings.SEMANTIC_ENABLED
    settings.SEMANTIC_ENABLED = True
    try:
        body = "Nothing on earth compares to this adaptive illumination gadget for your desk."
        findings, status, reason = run_semantic(db, norm=body.lower(), body=body, taken_spans=[])
        assert status == "ran"
        assert len(findings) >= 1
        f = findings[0]
        assert f.evidence_id == "CLAIM-01"
        assert f.source_engine == "semantic"
        assert f.match_type == "semantic"
        assert f.similarity is not None
        assert f.similarity >= 0.80
    finally:
        settings.SEMANTIC_ENABLED = orig_flag
        db.close()

def test_semantic_matcher_ignores_benign_lookalike():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db, force_reset=True)
    index_record(db, "rule", "CLAIM-01")

    orig_flag = settings.SEMANTIC_ENABLED
    settings.SEMANTIC_ENABLED = True
    try:
        body = "Our engineering department strictly follows industry best practices."
        findings, status, reason = run_semantic(db, norm=body.lower(), body=body, taken_spans=[])
        assert status == "ran"
        assert len(findings) == 0
    finally:
        settings.SEMANTIC_ENABLED = orig_flag
        db.close()
