"""
Embedding indexing, vector storage, and semantic similarity search service.
Supports real Gemini embeddings and offline MockEmbedder with concept lexicon.
"""
import re
import hashlib
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..config import settings
from ..models import Embedding, Rule, Fact
from ..engine.vectors import cosine_similarity
from ..llm.gemini_client import embed_texts as gemini_embed_texts, GeminiError, EmbeddingUnavailable
from ..db import has_pgvector

logger = logging.getLogger(__name__)

@dataclass
class EmbeddingHit:
    owner_type: str
    owner_id: str
    facet_key: str
    source_text: str
    sim: float

# In-process LRU cache for query embeddings: sha256(text) -> list[float]
_QUERY_EMBED_CACHE: Dict[str, List[float]] = {}
_CACHE_MAX_ENTRIES = 512
_GEMINI_EMBED_DISABLED = False

class MockEmbedder:
    """
    Deterministic offline embedder for tests, CI, and local demos.
    Generates 768-dim L2-normalized vectors via character 3-grams
    augmented with a curated semantic concept lexicon.
    """
    SUPERLATIVE_PATTERNS = [
        r"\bworld'?s best\b", r"\bbest in the world\b", r"\bgreatest\b", r"\bfinest\b",
        r"\bunmatched\b", r"\bnothing compares\b", r"\bnothing on earth\b",
        r"\bsecond to none\b", r"\bnumber one\b", r"\bincomparable\b", r"\bsuperior\b",
        r"\bunbeatable\b", r"\bbest\b"
    ]
    ABSOLUTE_PATTERNS = [
        r"\bguaranteed\b", r"\balways\b", r"\bnever fails\b", r"\b100%\b", r"\brisk-free\b"
    ]
    HEALTH_PATTERNS = [
        r"\bcure\b", r"\bheals\b", r"\bmedicinal\b", r"\btherapy\b"
    ]

    @classmethod
    def embed_single(cls, text: str, dim: int = 768) -> List[float]:
        norm = text.lower().strip()
        vec = np.zeros(dim, dtype=float)

        # 1. Base 3-gram hashing
        for i in range(len(norm) - 2):
            trigram = norm[i:i + 3]
            h = int(hashlib.md5(trigram.encode("utf-8")).hexdigest(), 16)
            idx = h % (dim - 32)
            vec[idx] += 1.0

        # 2. Concept lexicon semantic injection
        is_superlative = "best practice" not in norm and any(re.search(pat, norm) for pat in cls.SUPERLATIVE_PATTERNS)
        if is_superlative:
            vec[dim - 10:dim - 5] += 20.0

        if any(re.search(pat, norm) for pat in cls.ABSOLUTE_PATTERNS):
            vec[dim - 5:dim] += 20.0

        if any(re.search(pat, norm) for pat in cls.HEALTH_PATTERNS):
            vec[dim - 15:dim - 10] += 20.0

        # L2 normalize
        norm_val = np.linalg.norm(vec)
        if norm_val > 0:
            vec = vec / norm_val
        return [float(x) for x in vec]

    @classmethod
    def embed_batch(cls, texts: List[str], dim: int = 768) -> List[List[float]]:
        return [cls.embed_single(t, dim) for t in texts]

def _sha256(text: str) -> str:
    return hashlib.sha256(text.strip().lower().encode("utf-8")).hexdigest()

def embed_queries(texts: List[str], timeout: float = 6.0) -> List[List[float]]:
    """
    Generates embeddings for search query spans with caching and provider fallback.
    """
    results: List[Optional[List[float]]] = [None] * len(texts)
    to_fetch_indices: List[int] = []
    to_fetch_texts: List[str] = []

    for idx, text in enumerate(texts):
        key = _sha256(text)
        if key in _QUERY_EMBED_CACHE:
            results[idx] = _QUERY_EMBED_CACHE[key]
        else:
            to_fetch_indices.append(idx)
            to_fetch_texts.append(text)

    if to_fetch_texts:
        global _GEMINI_EMBED_DISABLED
        if _GEMINI_EMBED_DISABLED or settings.EMBEDDING_PROVIDER == "mock" or not settings.LLM_ENABLED:
            new_vectors = MockEmbedder.embed_batch(to_fetch_texts, dim=settings.EMBEDDING_DIM)
        else:
            try:
                new_vectors = gemini_embed_texts(to_fetch_texts, task="RETRIEVAL_QUERY", timeout=timeout)
            except Exception as exc:
                _GEMINI_EMBED_DISABLED = True
                logger.warning("Gemini embed_queries failed (%s); tripped circuit breaker to permanent MockEmbedder", exc)
                new_vectors = MockEmbedder.embed_batch(to_fetch_texts, dim=settings.EMBEDDING_DIM)

        for idx, vec in zip(to_fetch_indices, new_vectors):
            results[idx] = vec
            key = _sha256(texts[idx])
            if len(_QUERY_EMBED_CACHE) >= _CACHE_MAX_ENTRIES:
                _QUERY_EMBED_CACHE.pop(next(iter(_QUERY_EMBED_CACHE)))
            _QUERY_EMBED_CACHE[key] = vec

    return [r for r in results if r is not None]

def embed_documents(texts: List[str]) -> List[List[float]]:
    """Generates embeddings for knowledge base documents/facets."""
    if not texts:
        return []
    global _GEMINI_EMBED_DISABLED
    if _GEMINI_EMBED_DISABLED or settings.EMBEDDING_PROVIDER == "mock" or not settings.LLM_ENABLED:
        return MockEmbedder.embed_batch(texts, dim=settings.EMBEDDING_DIM)
    try:
        return gemini_embed_texts(texts, task="RETRIEVAL_DOCUMENT", timeout=12.0)
    except Exception as exc:
        _GEMINI_EMBED_DISABLED = True
        logger.warning("Gemini embed_documents failed (%s); tripped circuit breaker to permanent MockEmbedder", exc)
        return MockEmbedder.embed_batch(texts, dim=settings.EMBEDDING_DIM)

def index_record(arg1: Any, arg2: Any, arg3: Any = None) -> int:
    """
    Indexes rule or fact text facets into the embeddings table.
    Accepts both index_record(db, owner_type, owner_id) and index_record(owner_type, owner_id, db).
    """
    if isinstance(arg1, Session):
        db: Session = arg1
        owner_type: str = arg2
        owner_id: str = arg3
    else:
        owner_type: str = arg1
        owner_id: str = arg2
        db: Session = arg3

    facets: List[Tuple[str, str]] = []  # (facet_key, source_text)

    if owner_type == "rule":
        rule = db.query(Rule).filter(Rule.id == owner_id).first()
        if not rule or rule.status == "retired":
            db.query(Embedding).filter(Embedding.owner_type == "rule", Embedding.owner_id == owner_id).delete()
            db.commit()
            return 0

        # Don't embed visual or contrast rules
        if rule.type in ("palette", "contrast"):
            return 0

        # Extract rule phrases
        pattern = rule.pattern or {}
        phrases: List[str] = []
        if "phrases" in pattern:
            phrases.extend(pattern["phrases"])
        if "avoid" in pattern:
            phrases.extend(pattern["avoid"])
        if "regex" in pattern:
            reg_str = pattern["regex"]
            clean_reg = reg_str.replace("\\b", "").strip("()")
            parts = [p.strip() for p in clean_reg.split("|") if len(p.strip()) >= 2 and not p.startswith("!")]
            phrases.extend(parts)

        # For CLAIM-01, ensure key superlative phrases are represented
        if rule.id == "CLAIM-01":
            phrases.extend(["world's best", "best in the world"])

        for p in set(phrases):
            if p and len(p.strip()) >= 2:
                facets.append((f"phrase:{p.strip().lower()}", p.strip()))

        if rule.message:
            facets.append(("message", rule.message.strip()))

    elif owner_type == "fact":
        fact = db.query(Fact).filter(Fact.id == owner_id).first()
        if not fact or fact.status == "retired":
            db.query(Embedding).filter(Embedding.owner_type == "fact", Embedding.owner_id == owner_id).delete()
            db.commit()
            return 0

        if fact.statement:
            facets.append(("statement", fact.statement.strip()))

    if not facets:
        return 0

    texts_to_embed = [f[1] for f in facets]
    vecs = embed_documents(texts_to_embed)

    count = 0
    model_name = settings.EMBEDDING_MODEL

    for (facet_key, source_text), vec in zip(facets, vecs):
        thash = _sha256(source_text)
        existing = db.query(Embedding).filter(
            Embedding.owner_type == owner_type,
            Embedding.owner_id == owner_id,
            Embedding.facet_key == facet_key,
            Embedding.model == model_name
        ).first()

        if existing:
            if existing.text_hash != thash:
                existing.source_text = source_text
                existing.text_hash = thash
                existing.vector = vec
        else:
            emb = Embedding(
                owner_type=owner_type,
                owner_id=owner_id,
                facet_key=facet_key,
                source_text=source_text,
                text_hash=thash,
                model=model_name,
                vector=vec
            )
            db.add(emb)
        count += 1

    db.commit()
    return count

def search(
    db: Session,
    qvec: List[float],
    top_k: int = 3,
    owner_types: Tuple[str, ...] = ("rule", "fact")
) -> List[EmbeddingHit]:
    """
    Search indexed embeddings using pgvector cosine distance if supported,
    falling back to NumPy brute-force in-memory scan.
    """
    if db.bind.dialect.name == "postgresql" and has_pgvector:
        try:
            d = Embedding.vector.cosine_distance(qvec)
            stmt = select(Embedding, (1.0 - d).label("sim")).where(
                Embedding.owner_type.in_(owner_types),
                Embedding.model == settings.EMBEDDING_MODEL
            ).order_by(d).limit(top_k)
            rows = db.execute(stmt).all()
            return [EmbeddingHit(e.owner_type, e.owner_id, e.facet_key, e.source_text, float(s)) for e, s in rows]
        except Exception:
            pass

    # Fallback brute force
    records = db.query(Embedding).filter(
        Embedding.owner_type.in_(owner_types),
        Embedding.model == settings.EMBEDDING_MODEL
    ).all()

    if not records:
        return []

    hits: List[EmbeddingHit] = []
    qarr = np.asarray(qvec, dtype=float)

    for rec in records:
        vec_data = rec.vector
        if isinstance(vec_data, (list, tuple)):
            sim = cosine_similarity(qarr, vec_data)
            hits.append(EmbeddingHit(rec.owner_type, rec.owner_id, rec.facet_key, rec.source_text, sim))

    hits.sort(key=lambda h: h.sim, reverse=True)
    return hits[:top_k]

def reindex_all(db: Session) -> int:
    """Reindexes all active rules and facts in the knowledge base."""
    total = 0
    rules = db.query(Rule).filter(Rule.status == "current").all()
    for r in rules:
        total += index_record(db, "rule", r.id)

    facts = db.query(Fact).filter(Fact.status == "current").all()
    for f in facts:
        total += index_record(db, "fact", f.id)

    return total
