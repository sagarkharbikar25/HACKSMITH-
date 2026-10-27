"""
Text normalization preserving 1:1 character length and Unicode code-point alignment.
"""

TRANSLATION_TABLE = str.maketrans({
    "“": '"',
    "”": '"',
    "‘": "'",
    "’": "'",
    "«": '"',
    "»": '"',
    "\u00a0": " ",  # non-breaking space
    "\u2002": " ",  # en space
    "\u2003": " ",  # em space
    "\u2009": " ",  # thin space
    "\u2013": "-",  # en dash
    "\u2014": "-",  # em dash
})

def normalize_text(text: str) -> str:
    """
    Returns a normalized copy of the text with identical length and indices.
    Offsets in the normalized string match 1:1 with the original string.
    """
    if not text:
        return ""
    return text.translate(TRANSLATION_TABLE)
