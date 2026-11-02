"""
Dominant color quantization and brand palette compliance engine.
"""
from typing import List, Tuple, Dict, Any, Optional
from dataclasses import dataclass
import numpy as np
from PIL import Image
from ...schemas import BBox, SwatchOut, PaletteColorOut
from .color import hex_to_rgb, rgb_to_hex, rgb_to_lab, delta_e76

@dataclass
class Dominant:
    hex: str
    rgb: Tuple[int, int, int]
    share: float
    index: int

def dominant_colors(img: Image.Image, k: int = 6, max_side: int = 200) -> Tuple[List[Dominant], np.ndarray]:
    """
    Extracts k dominant colors from an image using fast median-cut quantization.
    Returns (list of Dominant colors sorted by share descending, index map array).
    """
    im = img.convert("RGB")
    im.thumbnail((max_side, max_side))
    q = im.quantize(colors=k, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = q.getpalette()[:k * 3]
    total_pixels = im.width * im.height

    raw_colors = q.getcolors() or []
    sorted_colors = sorted(raw_colors, key=lambda c: c[0], reverse=True)

    out = []
    for cnt, idx in sorted_colors:
        rgb = tuple(pal[idx * 3:idx * 3 + 3])
        out.append(Dominant(
            hex=rgb_to_hex(rgb),
            rgb=rgb,
            share=cnt / total_pixels,
            index=idx
        ))

    return out, np.asarray(q)

def region_bbox(index_map: np.ndarray, idx: int, lo: float = 2.0, hi: float = 98.0) -> BBox:
    """
    Calculates a robust normalized bounding box [0, 1] for pixels matching color index,
    filtering out isolated outlier pixels using percentiles.
    """
    ys, xs = np.nonzero(index_map == idx)
    h, w = index_map.shape
    if len(xs) == 0 or len(ys) == 0:
        return BBox(x=0.0, y=0.0, w=1.0, h=1.0)

    x0, x1 = np.percentile(xs, [lo, hi])
    y0, y1 = np.percentile(ys, [lo, hi])

    box_x = max(0.0, min(1.0, float(x0 / w)))
    box_y = max(0.0, min(1.0, float(y0 / h)))
    box_w = max(0.001, min(1.0 - box_x, float((x1 - x0 + 1) / w)))
    box_h = max(0.001, min(1.0 - box_y, float((y1 - y0 + 1) / h)))

    return BBox(x=round(box_x, 4), y=round(box_y, 4), w=round(box_w, 4), h=round(box_h, 4))

def check_palette(
    img: Image.Image,
    palette: List[Dict[str, Any]],
    max_de: float = 25.0,
    min_share: float = 0.06,
    allow_neutrals: bool = True
) -> Tuple[List[SwatchOut], List[Tuple[Dominant, Dict[str, Any], float]], np.ndarray]:
    """
    Compares image dominant colors against approved brand palette.
    Flags colors exceeding max_de that have significant visual share.
    """
    if not palette:
        palette = [
            {"name": "Lumora Amber", "hex": "#F2A93B", "role": "primary"},
            {"name": "Midnight Navy", "hex": "#14213D", "role": "secondary"},
            {"name": "Warm White", "hex": "#FAF7F2", "role": "neutral"},
            {"name": "Soft Teal", "hex": "#2A9D8F", "role": "accent"}
        ]

    pal_lab = rgb_to_lab([hex_to_rgb(c["hex"]) for c in palette])
    doms, idx_map = dominant_colors(img)
    swatches: List[SwatchOut] = []
    flagged: List[Tuple[Dominant, Dict[str, Any], float]] = []

    for d in doms:
        lab = rgb_to_lab(d.rgb)
        des = delta_e76(pal_lab, lab)
        best_j = int(np.argmin(des))
        de = float(des[best_j])
        nearest = palette[best_j]

        # Neutral color check (chroma C* = sqrt(a*^2 + b*^2) < 8.0)
        chroma = float(np.hypot(lab[1], lab[2]))
        is_neutral = chroma < 8.0

        if d.share < min_share:
            status = "minor"
        elif allow_neutrals and is_neutral:
            status = "neutral_allowed"
        elif de > max_de:
            status = "off_palette"
            flagged.append((d, nearest, de))
        else:
            status = "on_palette"

        swatches.append(SwatchOut(
            hex=d.hex,
            share=round(d.share, 4),
            nearest_hex=nearest["hex"],
            nearest_name=nearest.get("name"),
            delta_e=round(de, 1),
            status=status
        ))

    return swatches, flagged, idx_map

