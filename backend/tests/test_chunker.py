"""
Unit tests for chunker.py: page boundary preservation, chunk grouping, size caps.
"""
from app.services.document_parser import Page
from app.services.chunker import chunk_pages, Chunk

def test_chunk_pages_preserves_page_boundaries():
    pages = [
        Page(number=1, section=None, text="Page 1 sentence about branding."),
        Page(number=2, section=None, text="Page 2 sentence about hardware."),
        Page(number=3, section=None, text="Page 3 sentence about claims.")
    ]

    chunks = chunk_pages(pages, max_chars=1000, max_chunks=10)
    assert len(chunks) == 1
    chunk = chunks[0]
    assert chunk.pages == [1, 2, 3]
    assert "[[PAGE 1]]" in chunk.text
    assert "[[PAGE 2]]" in chunk.text
    assert "[[PAGE 3]]" in chunk.text

def test_chunk_pages_splits_on_character_budget():
    pages = [
        Page(number=1, section=None, text="A" * 600),
        Page(number=2, section=None, text="B" * 600),
    ]

    # max_chars=800 means each page must become its own chunk
    chunks = chunk_pages(pages, max_chars=800, max_chunks=10)
    assert len(chunks) == 2
    assert chunks[0].pages == [1]
    assert chunks[1].pages == [2]

def test_chunk_pages_caps_at_max_chunks():
    pages = [Page(number=i, section=None, text=f"Content for page {i}") for i in range(1, 15)]
    chunks = chunk_pages(pages, max_chars=30, max_chunks=3)
    assert len(chunks) <= 3

