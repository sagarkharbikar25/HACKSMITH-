"""
BrandGuard AI - FastAPI Application Entry Point.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError

from .config import settings
from .db import engine, Base, SessionLocal
from .models import Submission
from .seed import seed_database
from .seed_demo_submissions import seed_demo_submissions
from .routers import auth, submissions, findings, review, knowledge, insights, admin

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Ensure tables exist
    Base.metadata.create_all(bind=engine)
    # 2. Seed database idempotently on startup
    db = SessionLocal()
    try:
        seed_database(db, force_reset=False)
        if db.query(Submission).count() == 0:
            seed_demo_submissions(db)
    finally:
        db.close()
    yield

app = FastAPI(
    title="BrandGuard AI - Content Compliance & Governance API",
    description="Automated brand guideline and factual consistency verification engine.",
    version=settings.VERSION,
    lifespan=lifespan
)

# CORS Configuration
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
if "*" in origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Standardized Error Handling
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": "HTTP_ERROR", "message": str(exc.detail), "details": {}}}
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request payload validation failed",
                "details": exc.errors()
            }
        }
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred processing your request.",
                "details": {"exception": str(exc)}
            }
        }
    )

# Health Check (Both /health and /api/health)
@app.get("/health")
@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "db": "connected",
        "llm_enabled": settings.LLM_ENABLED,
        "version": settings.VERSION
    }

# Register Routers under /api
app.include_router(auth.router, prefix="/api")
app.include_router(submissions.router, prefix="/api")
app.include_router(findings.router, prefix="/api")
app.include_router(review.router, prefix="/api")
app.include_router(knowledge.router, prefix="/api")
app.include_router(insights.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
