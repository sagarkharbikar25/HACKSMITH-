"""
Text region detection within marketing images.
Supports Gemini Vision API with SHA-256 fixture fallbacks for offline testing and demos.
"""
import os
import json
import logging
from typing import List, Tuple, Optional, Dict, Any
from dataclasses import dataclass
from ...config import settings
from ...schemas import BBox

logger = logging.getLogger(__name__)

@dataclass
class TextRegion:
    text: str
    box: BBox

def _load_fixtures() -> Dict[str, List[Dict[str, Any]]]:
    candidates = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "data", "seed", "vision_fixtures.json"),
        os.path.join(os.getcwd(), "data", "seed", "vision_fixtures.json"),
        os.path.join(os.getcwd(), "backend", "data", "seed", "vision_fixtures.json")
    ]
    for p in candidates:
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
    return {}

def validate_regions(raw_list: List[Dict[str, Any]]) -> List[TextRegion]:
    """Validate, sanitize, and bound raw detected text regions."""
    valid: List[TextRegion] = []
    for item in raw_list[:12]:
        text = str(item.get("text", "")).strip()[:80]
        if not text:
            continue

        try:
            x = max(0.0, min(1.0, float(item.get("x", 0.0))))
            y = max(0.0, min(1.0, float(item.get("y", 0.0))))
            w = max(0.001, min(1.0 - x, float(item.get("w", 0.1))))
            h = max(0.001, min(1.0 - y, float(item.get("h", 0.05))))

            area = w * h
            if area < 0.0005 or area > 0.6:
                continue

            valid.append(TextRegion(
                text=text,
                box=BBox(x=round(x, 4), y=round(y, 4), w=round(w, 4), h=round(h, 4))
            ))
        except (ValueError, TypeError):
            continue

    return valid

def detect_text_regions(png_bytes: bytes, sha256_hash: str) -> Tuple[List[TextRegion], str, Optional[str]]:
    """
    Detects overlay text blocks in image bytes.
    Returns (regions, detector, reason). Detector is 'gemini', 'mock', or 'none'.
    """
    if settings.VISION_MODE == "mock" or not settings.LLM_ENABLED:
        fixtures = _load_fixtures()
        fx_data = fixtures.get(sha256_hash)
        if fx_data is not None:
            return validate_regions(fx_data), "mock", None
        return [], "mock", "no_text_detected"

    # Real Gemini Vision detection with fallback to fixtures
    try:
        from ...llm.vision import detect_regions_gemini
        raw_boxes = detect_regions_gemini(png_bytes, timeout=8.0)
        regions = validate_regions(raw_boxes)
        if not regions:
            fixtures = _load_fixtures()
            fx_data = fixtures.get(sha256_hash)
            if fx_data is not None:
                return validate_regions(fx_data), "mock", None
        return regions, "gemini" if regions else "none", None if regions else "no_text_detected"
    except Exception as exc:
        logger.warning("Gemini vision text detection failed: %s; falling back to fixtures", exc)
        fixtures = _load_fixtures()
        fx_data = fixtures.get(sha256_hash)
        if fx_data is not None:
            return validate_regions(fx_data), "mock", None
        return [], "none", "timeout"

