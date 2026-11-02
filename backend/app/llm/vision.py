"""
Gemini Vision adapter for overlay text and bounding-box detection.
Provides structured region extraction and gracefully falls back on error or timeout.
"""
import base64
import json
import logging
from typing import List, Dict, Any
import httpx
from ..config import settings

logger = logging.getLogger(__name__)

_GEMINI_VISION_DISABLED = False

VISION_PROMPT = """Detect all visible text in this marketing image.
Return ONLY a valid JSON array of objects with the exact keys:
[{"text": "detected text", "x": 0.1, "y": 0.2, "w": 0.5, "h": 0.1}]
Where x, y, w, h are normalized coordinates between 0.0 and 1.0 (relative to image dimensions).
"""

def detect_regions_gemini(png_bytes: bytes, timeout: float = 8.0) -> List[Dict[str, Any]]:
    """
    Calls Gemini Vision model to detect text bounding boxes.
    Returns list of dicts with text, x, y, w, h.
    """
    global _GEMINI_VISION_DISABLED
    if _GEMINI_VISION_DISABLED or not settings.GEMINI_API_KEY or not settings.LLM_ENABLED or settings.VISION_MODE == "mock":
        return []

    try:
        b64_img = base64.b64encode(png_bytes).decode("utf-8")
        model = settings.GEMINI_VISION_MODEL or "gemini-1.5-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={settings.GEMINI_API_KEY}"

        payload = {
            "contents": [{
                "parts": [
                    {"text": VISION_PROMPT},
                    {
                        "inline_data": {
                            "mime_type": "image/png",
                            "data": b64_img
                        }
                    }
                ]
            }],
            "generationConfig": {
                "temperature": 0.1,
                "response_mime_type": "application/json"
            }
        }

        with httpx.Client(timeout=timeout) as client:
            resp = client.post(url, json=payload)
            if resp.status_code != 200:
                _GEMINI_VISION_DISABLED = True
                logger.warning("Gemini Vision HTTP %d (%s); tripped circuit breaker to fast local fixtures", resp.status_code, resp.text[:100])
                return []
            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                return []
            text_resp = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            parsed = json.loads(text_resp)
            if isinstance(parsed, list):
                return parsed
            elif isinstance(parsed, dict) and "regions" in parsed:
                return parsed["regions"]
            return []
    except Exception as exc:
        _GEMINI_VISION_DISABLED = True
        logger.warning("Gemini Vision detection exception: %s; tripped circuit breaker", exc)
        return []

