import os
from typing import Optional
try:
    from pydantic_settings import BaseSettings
except ImportError:
    from pydantic import BaseModel as BaseSettings

class Settings(BaseSettings):
    # Core & Database
    DATABASE_URL: str = "sqlite:///./test_brandguard.db" if os.getenv("TESTING") == "1" else os.getenv("DATABASE_URL", "sqlite:///./brandguard.db")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "supersecret-demo-jwt-key-brandguard-2026")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MIN: int = int(os.getenv("JWT_EXPIRE_MIN", "720"))
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,*")
    DEMO_MODE: bool = os.getenv("DEMO_MODE", "true").lower() in ("true", "1")
    VERSION: str = "0.9.0"

    # Gemini LLM Configuration
    LLM_ENABLED: bool = os.getenv("LLM_ENABLED", "true").lower() in ("true", "1")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")
    LLM_TIMEOUT_S: int = int(os.getenv("LLM_TIMEOUT_S", "8"))

    # --- Round 3 Feature Flags ---
    INGESTION_ENABLED: bool = os.getenv("INGESTION_ENABLED", "true").lower() in ("true", "1")
    VISION_ENABLED: bool = os.getenv("VISION_ENABLED", "true").lower() in ("true", "1")
    SEMANTIC_ENABLED: bool = os.getenv("SEMANTIC_ENABLED", "false").lower() in ("true", "1")
    GAP_ANALYSIS_ENABLED: bool = os.getenv("GAP_ANALYSIS_ENABLED", "true").lower() in ("true", "1")

    # --- Round 3 Gemini & Vision & Embeddings ---
    GEMINI_VISION_MODEL: str = os.getenv("GEMINI_VISION_MODEL", "gemini-2.5-flash")
    EMBEDDING_PROVIDER: str = os.getenv("EMBEDDING_PROVIDER", "gemini")  # gemini | mock
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-004")
    EMBEDDING_DIM: int = int(os.getenv("EMBEDDING_DIM", "768"))
    GEMINI_MIN_INTERVAL_S: float = float(os.getenv("GEMINI_MIN_INTERVAL_S", "4.2"))
    VISION_MODE: str = os.getenv("VISION_MODE", "live")  # live | mock
    EXTRACTION_MODE: str = os.getenv("EXTRACTION_MODE", "ai")  # ai | heuristic

    # --- Round 3 Ingestion & Asset Limits ---
    INGEST_MAX_MB: int = int(os.getenv("INGEST_MAX_MB", "15"))
    INGEST_MAX_PAGES: int = int(os.getenv("INGEST_MAX_PAGES", "60"))
    INGEST_CHUNK_CHARS: int = int(os.getenv("INGEST_CHUNK_CHARS", "8000"))
    INGEST_MAX_CHUNKS: int = int(os.getenv("INGEST_MAX_CHUNKS", "20"))
    ASSET_MAX_MB: int = int(os.getenv("ASSET_MAX_MB", "5"))
    ASSET_MAX_PIXELS: int = int(os.getenv("ASSET_MAX_PIXELS", "40000000"))
    ASSET_MAX_ACTIVE_PER_SUBMISSION: int = int(os.getenv("ASSET_MAX_ACTIVE_PER_SUBMISSION", "5"))

    # --- Round 3 Engine Thresholds ---
    SEMANTIC_FLAG_THRESHOLD: float = float(os.getenv("SEMANTIC_FLAG_THRESHOLD", "0.82"))
    SEMANTIC_REVIEW_THRESHOLD: float = float(os.getenv("SEMANTIC_REVIEW_THRESHOLD", "0.74"))
    SEMANTIC_INCLUDE_FACTS: bool = os.getenv("SEMANTIC_INCLUDE_FACTS", "true").lower() in ("true", "1")
    SEMANTIC_MAX_SENTENCES: int = int(os.getenv("SEMANTIC_MAX_SENTENCES", "40"))
    SEMANTIC_TIMEOUT_S: float = float(os.getenv("SEMANTIC_TIMEOUT_S", "6.0"))
    PALETTE_MAX_DELTA_E: float = float(os.getenv("PALETTE_MAX_DELTA_E", "25.0"))
    PALETTE_MIN_SHARE: float = float(os.getenv("PALETTE_MIN_SHARE", "0.06"))
    WCAG_MIN_RATIO: float = float(os.getenv("WCAG_MIN_RATIO", "4.5"))
    GAP_MIN_FIRED: int = int(os.getenv("GAP_MIN_FIRED", "5"))
    GAP_DISPUTE_RATE: float = float(os.getenv("GAP_DISPUTE_RATE", "0.4"))
    GAP_CLUSTER_COSINE: float = float(os.getenv("GAP_CLUSTER_COSINE", "0.78"))

    # Rate Limiting (5 attempts per 10s per route)
    RATE_LIMIT_ENABLED: bool = os.getenv("RATE_LIMIT_ENABLED", "true").lower() in ("true", "1")
    RATE_LIMIT_WINDOW_S: int = int(os.getenv("RATE_LIMIT_WINDOW_S", "10"))
    RATE_LIMIT_MAX_REQUESTS: int = int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "5"))

    # SMTP Email Delivery (Gmail / Standard SMTP)
    SMTP_ENABLED: bool = os.getenv("SMTP_ENABLED", "false").lower() in ("true", "1")
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "")

    model_config = {
        "env_file": None if os.getenv("TESTING") == "1" else ".env",
        "extra": "ignore"
    }

settings = Settings()
