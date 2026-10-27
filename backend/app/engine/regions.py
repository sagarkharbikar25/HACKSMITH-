"""
Region aliases and extraction heuristics for availability checking.
"""
import re
from typing import List, Tuple

# Mapping of region codes to matching patterns and human names
REGION_PATTERNS = [
    ("US", r"\b(the\s+)?(us|usa|u\.s\.|u\.s\.a\.|united\s+states(\s+of\s+america)?|america)\b", "the US"),
    ("GB", r"\b(the\s+)?(uk|u\.k\.|united\s+kingdom|great\s+britain|britain|england)\b", "the UK"),
    ("IN", r"\b(india|bharat)\b", "India"),
    ("EU", r"\b(europe|european\s+union|eu)\b", "Europe"),
    ("CA", r"\b(canada)\b", "Canada"),
    ("AU", r"\b(australia)\b", "Australia"),
    ("ALL", r"\b(worldwide|globally|everywhere|all\s+countries|across\s+the\s+globe)\b", "worldwide"),
]

AVAILABILITY_TRIGGERS = re.compile(
    r"\b(available|sold|ships?|shipping|launched|launching|in\s+stock|now\s+in|across|buy\s+in|store|stores)\b",
    re.IGNORECASE
)

def extract_regions(text: str) -> List[Tuple[str, int, int, str]]:
    """
    Extracts detected region codes along with start/end character offsets and matched text.
    Returns: list of (region_code, start_idx, end_idx, matched_str)
    """
    results = []
    for code, pattern, _ in REGION_PATTERNS:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            results.append((code, match.start(), match.end(), match.group(0)))
    return results
