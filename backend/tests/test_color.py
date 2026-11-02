"""
Unit tests for color math, sRGB <-> CIELAB conversion, and CIE76 Delta-E.
"""
import pytest
import numpy as np
from app.engine.vision.color import hex_to_rgb, rgb_to_hex, rgb_to_lab, delta_e76

def test_hex_rgb_roundtrip():
    assert hex_to_rgb("#FFFFFF") == (255, 255, 255)
    assert hex_to_rgb("#000000") == (0, 0, 0)
    assert hex_to_rgb("#F2A93B") == (242, 169, 59)
    assert rgb_to_hex((242, 169, 59)) == "#F2A93B"

def test_rgb_to_lab_white_and_black():
    white_lab = rgb_to_lab((255, 255, 255))
    assert pytest.approx(white_lab[0], abs=0.5) == 100.0
    assert pytest.approx(white_lab[1], abs=0.5) == 0.0
    assert pytest.approx(white_lab[2], abs=0.5) == 0.0

    black_lab = rgb_to_lab((0, 0, 0))
    assert pytest.approx(black_lab[0], abs=0.5) == 0.0

def test_delta_e76_extremes():
    # Maximum theoretical distance between pure black and pure white is ~100
    white_lab = rgb_to_lab((255, 255, 255))
    black_lab = rgb_to_lab((0, 0, 0))
    de = delta_e76(white_lab, black_lab)
    assert pytest.approx(float(de), abs=0.5) == 100.0

    # Identical colors distance is 0
    de_self = delta_e76(white_lab, white_lab)
    assert pytest.approx(float(de_self), abs=0.001) == 0.0

