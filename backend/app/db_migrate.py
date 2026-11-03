"""
Database schema migrations for additive columns in existing tables.
Runs idempotently on application startup.
"""
import logging
from sqlalchemy import text, inspect
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

ADD_COLUMNS = [  # (table, column, postgres_ddl, sqlite_ddl)
    ("findings", "similarity", "DOUBLE PRECISION", "FLOAT"),
    ("findings", "match_type", "VARCHAR(16)", "VARCHAR(16)"),
    ("rules", "source_citation", "VARCHAR(255)", "VARCHAR(255)"),
    ("rules", "source_document_id", "INTEGER", "INTEGER"),
    ("rules", "source_page", "INTEGER", "INTEGER"),
    ("rules", "previous_wording", "JSON", "JSON"),
    ("facts", "source_citation", "VARCHAR(255)", "VARCHAR(255)"),
    ("facts", "source_document_id", "INTEGER", "INTEGER"),
    ("facts", "source_page", "INTEGER", "INTEGER"),
    ("versions", "engines_semantic", "VARCHAR(16)", "VARCHAR(16)"),
]

def run_migrations(engine: Engine) -> None:
    """Check existing tables and add missing columns idempotently."""
    dialect_name = engine.dialect.name
    with engine.begin() as conn:
        insp = inspect(conn)
        table_names = set(insp.get_table_names())
        for item in ADD_COLUMNS:
            table, col = item[0], item[1]
            ddl = item[3] if dialect_name == "sqlite" else item[2]

            if table not in table_names:
                continue

            existing_cols = {c["name"] for c in insp.get_columns(table)}
            if col not in existing_cols:
                logger.info("Migrating table %s: adding column %s (%s)", table, col, ddl)
                try:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}"))
                except Exception as exc:
                    logger.warning("Migration failed for %s.%s: %s", table, col, exc)

        # Backfill default values for existing rows
        if "findings" in table_names:
            try:
                conn.execute(text("UPDATE findings SET match_type = 'exact' WHERE match_type IS NULL"))
                conn.execute(text("UPDATE findings SET source_engine = 'rules' WHERE source_engine IS NULL"))
            except Exception as exc:
                logger.warning("Backfill findings defaults failed: %s", exc)

