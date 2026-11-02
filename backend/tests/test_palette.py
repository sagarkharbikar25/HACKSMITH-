"""
Unit tests for dominant color quantization and brand palette checking.
"""
import os
import pytest
from PIL import Image
from app.engine.vision.palette import dominant_colors, check_palette, region_bbox

def get_asset_path(filename: str) -> str:
    candidates = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "seed", "assets", filename),
        os.path.join(os.getcwd(), "data", "seed", "assets", filename)
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return candidates[0]

def test_palette_check_good_image():
    path = get_asset_path("lumora_good.png")
    assert os.path.exists(path), f"Fixture not found: {path}"
    img = Image.open(path)

    palette = [
        {"name": "Lumora Amber", "hex": "#F2A93B", "role": "primary"},
        {"name": "Midnight Navy", "hex": "#14213D", "role": "secondary"},
        {"name": "Warm White", "hex": "#FAF7F2", "role": "neutral"},
        {"name": "Soft Teal", "hex": "#2A9D8F", "role": "accent"}
    ]

    swatches, flagged, idx_map = check_palette(img, palette, max_de=25.0, min_share=0.06)
    # Good image uses strictly warm white, amber, and navy
    assert len(flagged) == 0, f"Expected 0 flagged colors, got {len(flagged)}"

def test_palette_check_bad_image():
    path = get_asset_path("lumora_bad_palette.png")
    assert os.path.exists(path), f"Fixture not found: {path}"
    img = Image.open(path)

    palette = [
        {"name": "Lumora Amber", "hex": "#F2A93B", "role": "primary"},
        {"name": "Midnight Navy", "hex": "#14213D", "role": "secondary"},
        {"name": "Warm White", "hex": "#FAF7F2", "role": "neutral"}
    ]

    swatches, flagged, idx_map = check_palette(img, palette, max_de=25.0, min_share=0.06)
    assert len(flagged) >= 1
    dom, nearest, de = flagged[0]
    # Crimson red is ~38 delta E from amber
    assert de > 25.0
    assert dom.share >= 0.30

    bbox = region_bbox(idx_map, dom.index)
    assert bbox.w > 0.5
    assert bbox.h > 0.3

