"""
Unit tests for WCAG relative luminance, contrast ratio calculation, and region measurement.
"""
import pytest
from PIL import Image
from app.engine.vision.contrast import relative_luminance, contrast_ratio, measure_region
from app.engine.vision.color import hex_to_rgb
from app.schemas import BBox

def test_relative_luminance_and_contrast_ratio():
    white_lum = relative_luminance((255, 255, 255))
    black_lum = relative_luminance((0, 0, 0))
    assert pytest.approx(white_lum, abs=0.001) == 1.0
    assert pytest.approx(black_lum, abs=0.001) == 0.0

    # Black on white ratio is 21.0
    ratio_max = contrast_ratio((0, 0, 0), (255, 255, 255))
    assert pytest.approx(ratio_max, abs=0.01) == 21.0

    # WCAG standard test cases against white:
    # #767676 on white is approx 4.54:1 (Passes AA)
    ratio_pass = contrast_ratio(hex_to_rgb("#767676"), hex_to_rgb("#FFFFFF"))
    assert ratio_pass >= 4.50
    assert pytest.approx(ratio_pass, abs=0.05) == 4.54

    # #777777 on white is approx 4.48:1 (Fails AA)
    ratio_fail = contrast_ratio(hex_to_rgb("#777777"), hex_to_rgb("#FFFFFF"))
    assert ratio_fail < 4.50
    assert pytest.approx(ratio_fail, abs=0.05) == 4.48

def test_measure_region_contrast():
    # Construct synthetic 100x100 crop with white background and dark text rectangle
    img = Image.new("RGB", (100, 100), color=(255, 255, 255))
    for x in range(30, 70):
        for y in range(40, 60):
            img.putpixel((x, y), (20, 33, 61))  # Navy

    res = measure_region(img, BBox(x=0.0, y=0.0, w=1.0, h=1.0))
    assert res is not None
    assert res["ratio"] >= 4.5
    assert not res["busy"]

