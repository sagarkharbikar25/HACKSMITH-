"""
LLM adapter stub.
Ayush can replace this or inject the live Gemini REST implementation.
Safe wrapper guarantees this function NEVER raises an unhandled exception.
"""
from ..engine.types import ContextPack, LLMResult
from ..config import settings

def review(body: str, ctx: ContextPack) -> LLMResult:
    """
    Standard LLM review signature.
    If LLM_ENABLED is False or GEMINI_API_KEY is not set, returns disabled.
    """
    if not settings.LLM_ENABLED or not settings.GEMINI_API_KEY:
        return LLMResult(
            status="disabled",
            reason="LLM review disabled in configuration",
            findings=[]
        )

    # Future / Ayush Gemini adapter hook
    try:
        # If API key is set and live adapter is plugged in
        return LLMResult(
            status="ran",
            reason=None,
            findings=[]
        )
    except Exception as exc:
        return LLMResult(
            status="unavailable",
            reason=f"LLM request error: {str(exc)}",
            findings=[]
        )
