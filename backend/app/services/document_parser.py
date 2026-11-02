"""
Document parser for PDF and DOCX guideline documents.
Extracts pages, text, headings/sections, and detects scanned pages.
"""
import io
import zipfile
from dataclasses import dataclass
from typing import List, Optional
from pypdf import PdfReader, PdfWriter
import docx
from ..config import settings

class IngestError(Exception):
    def __init__(self, code: str, message: str, details: Optional[dict] = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}

@dataclass
class Page:
    number: Optional[int]        # 1-based for PDF; None for DOCX
    section: Optional[str]       # nearest heading (DOCX) ; None for PDF
    text: str
    scanned: bool = False

def detect_mime_and_validate(data: bytes) -> str:
    """
    Validates file magic bytes. Never trust Content-Type or file extension.
    Returns detected MIME type or raises IngestError(415 UNSUPPORTED_FILE_TYPE).
    """
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    
    if data.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                namelist = zf.namelist()
                if "word/document.xml" in namelist or any(n.startswith("word/") for n in namelist):
                    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        except Exception:
            pass
            
    raise IngestError(
        code="UNSUPPORTED_FILE_TYPE",
        message="Only PDF (.pdf) and Word (.docx) guideline documents are supported."
    )

def parse_pdf(data: bytes, max_pages: Optional[int] = None) -> List[Page]:
    """
    Parses a PDF into Page objects using pypdf.
    Enforces password check, max pages, and scanned-page detection.
    """
    max_pages = max_pages or settings.INGEST_MAX_PAGES
    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception as e:
        raise IngestError("DOCUMENT_UNREADABLE", f"Could not parse PDF: {str(e)}")

    if reader.is_encrypted:
        raise IngestError("DOCUMENT_ENCRYPTED", "This PDF is password-protected and cannot be ingested.")

    total_pages = len(reader.pages)
    if total_pages > max_pages:
        raise IngestError("DOCUMENT_TOO_LONG", f"Document exceeds max allowed pages ({total_pages} > {max_pages}).")

    pages: List[Page] = []
    for idx, page in enumerate(reader.pages, start=1):
        txt = (page.extract_text() or "").strip()
        scanned = len(txt) < 40
        pages.append(Page(number=idx, section=None, text=txt, scanned=scanned))

    if all(p.scanned for p in pages) and not settings.LLM_ENABLED:
        raise IngestError("DOCUMENT_UNREADABLE", "Document appears to contain scanned images with no text layer, and AI reading is disabled.")

    return pages

def single_page_pdf(data: bytes, index0: int) -> bytes:
    """
    Extracts a single page (0-based) from PDF bytes as a new PDF byte buffer.
    Used for Gemini inline PDF fallback when a page is scanned.
    """
    reader = PdfReader(io.BytesIO(data))
    writer = PdfWriter()
    writer.add_page(reader.pages[index0])
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()

def parse_docx(data: bytes) -> List[Page]:
    """
    Parses a DOCX document into logical sections (Page with number=None, section=heading).
    """
    try:
        doc = docx.Document(io.BytesIO(data))
    except Exception as e:
        raise IngestError("DOCUMENT_UNREADABLE", f"Could not parse DOCX: {str(e)}")

    pages: List[Page] = []
    current_lines: List[str] = []
    current_section: Optional[str] = None

    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue

        style_name = (para.style.name if para.style else "").lower()
        if style_name.startswith("heading"):
            if current_lines:
                pages.append(Page(number=None, section=current_section, text="\n".join(current_lines)))
                current_lines = []
            current_section = text
        else:
            current_lines.append(text)

    # DOCX tables often hold brand guidelines/color codes/prohibitions
    for table in doc.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells:
                current_lines.append(" | ".join(cells))

    if current_lines:
        pages.append(Page(number=None, section=current_section, text="\n".join(current_lines)))

    if not pages:
        raise IngestError("DOCUMENT_UNREADABLE", "DOCX document contains no readable text or sections.")

    return pages

