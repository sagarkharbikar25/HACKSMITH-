import os
"""
Database session and connection management.
SQLite for local development, Postgres (pooler URL) in production.
Includes pgvector extension check and startup migration hooks.
"""
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import settings

logger = logging.getLogger(__name__)

db_url = "sqlite:///./test_brandguard.db" if os.getenv("TESTING") == "1" else settings.DATABASE_URL

# Normalize Supabase / Render PostgreSQL connection strings to explicitly use psycopg2
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

connect_args = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    connect_args = {
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
    }

engine_kwargs = {
    "connect_args": connect_args,
    "pool_pre_ping": False,
}

# High-performance connection pool configuration for PostgreSQL (Supabase / Render)
if not db_url.startswith("sqlite"):
    engine_kwargs.update({
        "pool_size": 20,
        "max_overflow": 20,
        "pool_recycle": 600,
        "pool_timeout": 30,
    })

engine = create_engine(
    db_url,
    **engine_kwargs
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

has_pgvector: bool = False

def ensure_pgvector() -> bool:
    """Ensure pgvector extension exists if connected to PostgreSQL."""
    global has_pgvector
    if engine.dialect.name != "postgresql":
        has_pgvector = False
        return False

    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        has_pgvector = True
        logger.info("pgvector extension verified on database.")
        return True
    except Exception as exc:
        has_pgvector = False
        logger.warning("Could not enable pgvector extension (falling back to in-memory numpy): %s", exc)
        return False

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
