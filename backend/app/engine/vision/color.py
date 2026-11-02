"""
Color conversion and distance mathematics (sRGB <-> CIELAB and CIE76 Delta-E).
"""
from typing import Tuple, Union
import numpy as np

# Standard sRGB to XYZ conversion matrix (D65 illuminant)
_M = np.array([
    [0.4124564, 0.3575761, 0.1804375],
    [0.2126729, 0.7151522, 0.0721750],
    [0.0193339, 0.1191920, 0.9503041]
])
_WHITE = np.array([0.95047, 1.0, 1.08883])  # D65 reference white

def hex_to_rgb(h: str) -> Tuple[int, int, int]:
    """Convert hex string (#RGB or #RRGGBB) to (r, g, b) integer tuple 0..255."""
    h = h.strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) != 6:
        raise ValueError(f"Invalid hex color format: {h!r}")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)

def rgb_to_hex(rgb: Union[Tuple[float, float, float], np.ndarray, list]) -> str:
    """Convert RGB 0..255 values to uppercase #RRGGBB hex string."""
    return "#%02X%02X%02X" % tuple(int(round(min(255, max(0, float(v))))) for v in rgb[:3])

def rgb_to_lab(rgb: Union[Tuple[float, float, float], np.ndarray, list]) -> np.ndarray:
    """
    Convert sRGB (0..255) to CIELAB L*a*b* under D65 standard illuminant.
    Accepts (3,) or (N, 3) shaped arrays/tuples and preserves input dimensions.
    """
    arr = np.asarray(rgb, dtype=float)
    orig_shape = arr.shape
    flat = arr.reshape(-1, 3) / 255.0

    # Linearize sRGB gamma
    lin = np.where(flat <= 0.04045, flat / 12.92, ((flat + 0.055) / 1.055) ** 2.4)

    # Convert to XYZ
    xyz = (lin @ _M.T) / _WHITE

    # CIE constants
    eps = 216.0 / 24389.0
    kappa = 24389.0 / 27.0

    f = np.where(xyz > eps, np.cbrt(np.maximum(xyz, 0)), (kappa * xyz + 16.0) / 116.0)
    lab = np.stack([
        116.0 * f[:, 1] - 16.0,
        500.0 * (f[:, 0] - f[:, 1]),
        200.0 * (f[:, 1] - f[:, 2])
    ], axis=1)

    return lab.reshape(orig_shape)

def delta_e76(lab1: Union[np.ndarray, list], lab2: Union[np.ndarray, list]) -> Union[float, np.ndarray]:
    """
    Euclidean distance between two CIELAB colors (CIE76 Delta-E).
    Values < 10 are close; 10..25 noticeable but tolerable; > 25 off-palette.
    """
    l1 = np.asarray(lab1, dtype=float)
    l2 = np.asarray(lab2, dtype=float)
    return np.linalg.norm(l1 - l2, axis=-1)

