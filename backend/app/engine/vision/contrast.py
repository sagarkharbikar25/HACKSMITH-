"""
WCAG 2.x AA text contrast ratio measurement engine.
Computes relative luminance, two-means text foreground/background segmentation, and contrast ratios.
"""
from typing import Tuple, Dict, Any, Optional
import numpy as np
from PIL import Image
from ...schemas import BBox
from .color import rgb_to_hex

def _lin(c: float) -> float:
    """WCAG sRGB gamma linearization."""
    c_norm = c / 255.0
    return c_norm / 12.92 if c_norm <= 0.03928 else ((c_norm + 0.055) / 1.055) ** 2.4

def relative_luminance(rgb: Tuple[float, float, float] | np.ndarray) -> float:
    """Computes WCAG relative luminance L (0..1) under standard sRGB coefficients."""
    r, g, b = float(rgb[0]), float(rgb[1]), float(rgb[2])
    return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b)

def contrast_ratio(
    fg: Tuple[float, float, float] | np.ndarray,
    bg: Tuple[float, float, float] | np.ndarray
) -> float:
    """
    Computes WCAG contrast ratio (L1 + 0.05) / (L2 + 0.05).
    Ranges from 1.0 (identical) to 21.0 (pure black on pure white).
    """
    l1 = relative_luminance(fg)
    l2 = relative_luminance(bg)
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)

def _two_means(px: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Segment pixels into two clusters (foreground text vs background)."""
    lum = px @ np.array([0.2126, 0.7152, 0.0722])
    c0, c1 = px[lum.argmin()], px[lum.argmax()]
    m = np.ones(len(px), dtype=bool)

    for _ in range(10):
        m = np.linalg.norm(px - c0, axis=1) <= np.linalg.norm(px - c1, axis=1)
        if m.all() or (~m).all():
            break
        c0, c1 = px[m].mean(0), px[~m].mean(0)

    return m, c0, c1

def measure_region(img: Image.Image, box: BBox, min_ratio: float = 4.5) -> Optional[Dict[str, Any]]:
    """
    Measures text vs background contrast within a normalized bounding box.
    Returns dict(fg, bg, ratio, worst, busy) or None if uniform / no text detected.
    """
    W, H = img.size
    x0 = int(box.x * W)
    y0 = int(box.y * H)
    x1 = int((box.x + box.w) * W)
    y1 = int((box.y + box.h) * H)

    crop = img.crop((x0, y0, x1, y1)).convert("RGB")
    if crop.width * crop.height < 64:
        return None

    crop.thumbnail((96, 96))
    px = np.asarray(crop).reshape(-1, 3).astype(float)
    if len(px) < 16:
        return None

    m, c0, c1 = _two_means(px)
    if m.all() or (~m).all():
        return None  # Uniform region, no distinguishable text

    major, minor = (m, ~m) if m.sum() >= (~m).sum() else (~m, m)
    if minor.mean() < 0.02:
        return None  # Text area fraction too small to measure reliably

    bg = px[major].mean(0)
    fg = px[minor].mean(0)
    ratio = contrast_ratio(fg, bg)

    # Check for busy or gradient background
    bg_lums = np.array([relative_luminance(p) for p in px[major][::3]])
    busy = float(bg_lums.std()) > 0.08
    fg_l = relative_luminance(fg)
    worst = float(np.percentile([(max(fg_l, l) + 0.05) / (min(fg_l, l) + 0.05) for l in bg_lums], 10))

    return {
        "fg": rgb_to_hex(fg),
        "bg": rgb_to_hex(bg),
        "ratio": round(ratio, 2),
        "worst": round(worst, 2),
        "busy": busy
    }

