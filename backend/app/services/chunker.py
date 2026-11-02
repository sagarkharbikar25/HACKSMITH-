"""
Chunking service for guideline documents.
Groups pages and sections into structured chunks with page boundaries ([[PAGE N]]) for LLM context.
"""
from dataclasses import dataclass, field
from typing import List, Optional
from .document_parser import Page
from ..config import settings

@dataclass
class Chunk:
    pages: List[int] = field(default_factory=list)
    sections: List[str] = field(default_factory=list)
    text: str = ""

def format_page_block(page: Page) -> str:
    if page.number is not None:
        header = f"[[PAGE {page.number}]]"
    elif page.section:
        header = f'[[SECTION "{page.section}"]]'
    else:
        header = "[[CONTENT]]"
    return f"{header}\n{page.text}\n"

def chunk_pages(
    pages: List[Page],
    max_chars: Optional[int] = None,
    max_chunks: Optional[int] = None
) -> List[Chunk]:
    """
    Groups consecutive pages into chunks up to max_chars without splitting pages
    (unless a single page exceeds 2 * max_chars). Caps total chunks at max_chunks.
    """
    max_chars = max_chars or settings.INGEST_CHUNK_CHARS
    max_chunks = max_chunks or getattr(settings, "INGEST_MAX_CHUNKS", 20)

    chunks: List[Chunk] = []
    current_pages: List[int] = []
    current_sections: List[str] = []
    current_text_parts: List[str] = []
    current_length = 0

    for page in pages:
        page_block = format_page_block(page)
        block_len = len(page_block)

        # If a single page is enormous (> 2 * max_chars), split by double newline
        if block_len > 2 * max_chars:
            # Flush current if exists
            if current_text_parts:
                chunks.append(Chunk(pages=current_pages, sections=current_sections, text="\n".join(current_text_parts).strip()))
                current_pages, current_sections, current_text_parts, current_length = [], [], [], 0
                if len(chunks) >= max_chunks:
                    break

            paragraphs = page.text.split("\n\n")
            sub_parts: List[str] = []
            sub_len = 0
            for para in paragraphs:
                sub_block = f"{para.strip()}\n"
                if sub_len + len(sub_block) > max_chars and sub_parts:
                    header = f"[[PAGE {page.number}]]\n" if page.number else (f'[[SECTION "{page.section}"]]' if page.section else "")
                    chunks.append(Chunk(
                        pages=[page.number] if page.number else [],
                        sections=[page.section] if page.section else [],
                        text=(header + "\n".join(sub_parts)).strip()
                    ))
                    sub_parts = []
                    sub_len = 0
                    if len(chunks) >= max_chunks:
                        break
                sub_parts.append(sub_block)
                sub_len += len(sub_block)
            if sub_parts and len(chunks) < max_chunks:
                header = f"[[PAGE {page.number}]]\n" if page.number else (f'[[SECTION "{page.section}"]]' if page.section else "")
                chunks.append(Chunk(
                    pages=[page.number] if page.number else [],
                    sections=[page.section] if page.section else [],
                    text=(header + "\n".join(sub_parts)).strip()
                ))
            if len(chunks) >= max_chunks:
                break
            continue

        if current_length + block_len > max_chars and current_text_parts:
            chunks.append(Chunk(
                pages=list(current_pages),
                sections=list(current_sections),
                text="\n".join(current_text_parts).strip()
            ))
            current_pages = []
            current_sections = []
            current_text_parts = []
            current_length = 0

            if len(chunks) >= max_chunks:
                break

        if page.number is not None and page.number not in current_pages:
            current_pages.append(page.number)
        if page.section and page.section not in current_sections:
            current_sections.append(page.section)
        current_text_parts.append(page_block)
        current_length += block_len

    if current_text_parts and len(chunks) < max_chunks:
        chunks.append(Chunk(
            pages=current_pages,
            sections=current_sections,
            text="\n".join(current_text_parts).strip()
        ))

    return chunks
