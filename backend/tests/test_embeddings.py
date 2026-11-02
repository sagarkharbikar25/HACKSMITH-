"""
Unit tests for vector math, MockEmbedder, embedding cache, and vector search.
"""
import pytest
import numpy as np
from app.engine.vectors import cosine_similarity, leader_cluster
from app.services.embedding_service import MockEmbedder, index_record, search
from app.db import Base, engine, SessionLocal
from app.seed import seed_database
from app.models import Rule, Embedding

def test_cosine_similarity():
    v1 = [1.0, 0.0, 0.0]
    v2 = [1.0, 0.0, 0.0]
    assert pytest.approx(cosine_similarity(v1, v2), 0.001) == 1.0

    v3 = [0.0, 1.0, 0.0]
    assert pytest.approx(cosine_similarity(v1, v3), 0.001) == 0.0

def test_leader_cluster():
    # 3 identical vectors and 1 orthogonal vector
    vecs = np.array([
        [1.0, 0.0, 0.0],
        [0.99, 0.01, 0.0],
        [0.98, 0.02, 0.0],
        [0.0, 1.0, 0.0]
    ])
    clusters = leader_cluster(vecs, threshold=0.90)
    assert len(clusters) == 2
    assert len(clusters[0]) == 3  # First cluster has 3 similar vectors
    assert len(clusters[1]) == 1

def test_mock_embedder_concept_lexicon():
    # True superlative paraphrase
    v_target = MockEmbedder.embed_single("world's best smart lamp")
    v_para = MockEmbedder.embed_single("nothing on earth compares to this smart lamp")
    sim_para = cosine_similarity(v_target, v_para)
    assert sim_para >= 0.80, f"Expected high similarity for paraphrase, got {sim_para}"

    # Benign lookalike
    v_benign = MockEmbedder.embed_single("we follow industry best practices in manufacturing")
    sim_benign = cosine_similarity(v_target, v_benign)
    assert sim_benign < 0.80, f"Expected lower similarity for benign text, got {sim_benign}"

def test_index_and_search_records():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db, force_reset=True)

    # Index CLAIM-01
    indexed = index_record(db, "rule", "CLAIM-01")
    assert indexed >= 1

    # Search with a query
    qvec = MockEmbedder.embed_single("nothing on earth compares to our brightness")
    hits = search(db, qvec, top_k=3, owner_types=("rule",))
    assert len(hits) >= 1
    assert hits[0].owner_id == "CLAIM-01"
    db.close()

