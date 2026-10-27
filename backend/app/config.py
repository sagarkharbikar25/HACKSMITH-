import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./brandguard.db")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "supersecret-demo-jwt-key-brandguard-2026")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MIN: int = int(os.getenv("JWT_EXPIRE_MIN", "720"))
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,*")
    DEMO_MODE: bool = os.getenv("DEMO_MODE", "true").lower() in ("true", "1")
    LLM_ENABLED: bool = os.getenv("LLM_ENABLED", "false").lower() in ("true", "1")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    LLM_TIMEOUT_S: int = int(os.getenv("LLM_TIMEOUT_S", "8"))
    VERSION: str = "0.9.0"

    model_config = {
        "env_file": ".env",
        "extra": "ignore"
    }

settings = Settings()
