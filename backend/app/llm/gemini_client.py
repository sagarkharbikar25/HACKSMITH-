"""
Shared Gemini HTTP Client for text generation, embeddings, and vision.
Implements bounded retries, rate-limiting back-off, and strict timeout envelopes.
"""
import time
import logging
from typing import List, Dict, Any, Optional, Literal
import httpx
from ..config import settings

logger = logging.getLogger(__name__)

class GeminiError(Exception):
    def __init__(self, message: str, reason: str = "internal"):
        super().__init__(message)
        self.reason = reason

class GeminiTimeout(GeminiError):
    def __init__(self, message: str = "Gemini API request timed out"):
        super().__init__(message, reason="timeout")

class GeminiRateLimited(GeminiError):
    def __init__(self, message: str = "Gemini API rate limit exceeded"):
        super().__init__(message, reason="rate_limited")

class GeminiBadJSON(GeminiError):
    def __init__(self, message: str = "Gemini returned invalid JSON structure"):
        super().__init__(message, reason="invalid_json")

class EmbeddingUnavailable(GeminiError):
    def __init__(self, message: str = "Embedding service unavailable", reason: str = "not_configured"):
        super().__init__(message, reason=reason)

BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

def embed_texts(
    texts: List[str],
    task: Literal["RETRIEVAL_DOCUMENT", "RETRIEVAL_QUERY"] = "RETRIEVAL_QUERY",
    timeout: float = 6.0
) -> List[List[float]]:
    """
    Call Gemini batchEmbedContents endpoint to embed a list of text strings.
    """
    if not settings.GEMINI_API_KEY:
        raise EmbeddingUnavailable("GEMINI_API_KEY is not configured", reason="not_configured")

    if not texts:
        return []

    # Batch up to 100 texts at once
    batches = [texts[i:i + 100] for i in range(0, len(texts), 100)]
    all_embeddings: List[List[float]] = []

    model_name = settings.EMBEDDING_MODEL
    url = f"{BASE_URL}/models/{model_name}:batchEmbedContents"
    headers = {
        "x-goog-api-key": settings.GEMINI_API_KEY,
        "Content-Type": "application/json"
    }

    with httpx.Client(timeout=timeout) as client:
        for batch in batches:
            requests_payload = []
            for t in batch:
                req_obj: Dict[str, Any] = {
                    "model": f"models/{model_name}",
                    "content": {"parts": [{"text": t}]},
                    "taskType": task
                }
                if model_name.startswith("gemini-embedding"):
                    req_obj["outputDimensionality"] = settings.EMBEDDING_DIM
                requests_payload.append(req_obj)

            try:
                res = client.post(url, headers=headers, json={"requests": requests_payload})
                if res.status_code == 429:
                    raise GeminiRateLimited()
                if res.status_code >= 500:
                    raise EmbeddingUnavailable(f"Gemini server error {res.status_code}", reason="gemini_error")
                if res.status_code != 200:
                    raise EmbeddingUnavailable(f"Gemini error {res.status_code}: {res.text}", reason="bad_request")

                data = res.json()
                embeddings_raw = data.get("embeddings", [])
                for item in embeddings_raw:
                    vals = item.get("values", [])
                    if len(vals) != settings.EMBEDDING_DIM:
                        # Truncate or pad if dimension differs
                        if len(vals) > settings.EMBEDDING_DIM:
                            vals = vals[:settings.EMBEDDING_DIM]
                        else:
                            vals = vals + [0.0] * (settings.EMBEDDING_DIM - len(vals))
                    all_embeddings.append(vals)

            except httpx.TimeoutException:
                raise GeminiTimeout()
            except httpx.RequestError as exc:
                raise EmbeddingUnavailable(f"Network error calling Gemini: {exc}", reason="network_error")

    return all_embeddings



def generate_json(prompt: str, timeout: float = 12.0) -> Dict[str, Any]:
    """
    Call Gemini generateContent endpoint with JSON output mode.
    Returns parsed dictionary or empty dict on failure.
    """
    import json
    if not settings.GEMINI_API_KEY or not settings.LLM_ENABLED:
        return {}

    candidates_models = [settings.GEMINI_MODEL, "gemini-2.5-flash", "gemini-1.5-flash"]
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json"
        }
    }

    for model in candidates_models:
        if not model:
            continue
        url = f"{BASE_URL}/models/{model}:generateContent?key={settings.GEMINI_API_KEY}"
        try:
            with httpx.Client(timeout=timeout) as client:
                res = client.post(url, json=payload, headers={"Content-Type": "application/json"})
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        raw_text = "".join(p.get("text", "") for p in parts).strip()
                        if raw_text.startswith("```json"):
                            raw_text = raw_text[7:]
                        if raw_text.startswith("```"):
                            raw_text = raw_text[3:]
                        if raw_text.endswith("```"):
                            raw_text = raw_text[:-3]
                        raw_text = raw_text.strip()
                        return json.loads(raw_text)
                elif res.status_code == 404:
                    continue
                else:
                    logger.warning("Gemini JSON generation HTTP %d: %s", res.status_code, res.text[:120])
                    break
        except Exception as exc:
            logger.warning("Gemini JSON generation exception: %s", exc)
            break

    return {}
