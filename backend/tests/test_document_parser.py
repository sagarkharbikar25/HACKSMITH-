"""
Unit tests for document_parser.py: PDF and DOCX extraction, magic bytes, limits, encryption.
"""
import io
import pytest
from pypdf import PdfWriter
from app.services.document_parser import (
    detect_mime_and_validate,
    parse_pdf,
    parse_docx,
    single_page_pdf,
    IngestError
)

def test_detect_mime_pdf_and_docx():
    # PDF magic byte
    pdf_bytes = b"%PDF-1.4\nfake content"
    assert detect_mime_and_validate(pdf_bytes) == "application/pdf"

    # Unsupported magic byte
    with pytest.raises(IngestError) as exc:
        detect_mime_and_validate(b"INVALID_MAGIC_HEADER")
    assert exc.value.code == "UNSUPPORTED_FILE_TYPE"

def test_parse_pdf_valid(tmp_path):
    # Create simple 2-page PDF
    from reportlab.pdfgen import canvas
    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    c.drawString(100, 700, "Page 1 Content: Lumora Smart Lamp guidelines and brand rules.")
    c.showPage()
    c.drawString(100, 700, "Page 2 Content: Hardware specifications and battery life.")
    c.showPage()
    c.save()
    pdf_bytes = buf.getvalue()

    pages = parse_pdf(pdf_bytes, max_pages=10)
    assert len(pages) == 2
    assert pages[0].number == 1
    assert "Page 1 Content" in pages[0].text
    assert pages[1].number == 2
    assert "Page 2 Content" in pages[1].text
    assert pages[0].scanned is False

def test_parse_pdf_exceeds_max_pages():
    from reportlab.pdfgen import canvas
    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    for i in range(5):
        c.drawString(100, 700, f"Page {i+1}")
        c.showPage()
    c.save()
    pdf_bytes = buf.getvalue()

    with pytest.raises(IngestError) as exc:
        parse_pdf(pdf_bytes, max_pages=3)
    assert exc.value.code == "DOCUMENT_TOO_LONG"

def test_parse_pdf_encrypted():
    from reportlab.pdfgen import canvas
    from pypdf import PdfReader, PdfWriter
    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    c.drawString(100, 700, "Secret Page")
    c.showPage()
    c.save()

    r = PdfReader(io.BytesIO(buf.getvalue()))
    w = PdfWriter()
    w.add_page(r.pages[0])
    w.encrypt("secret_pass")
    enc_buf = io.BytesIO()
    w.write(enc_buf)

    with pytest.raises(IngestError) as exc:
        parse_pdf(enc_buf.getvalue())
    assert exc.value.code == "DOCUMENT_ENCRYPTED"

def test_parse_docx_headings_and_tables():
    import docx
    doc = docx.Document()
    doc.add_heading("Branding Section", level=1)
    doc.add_paragraph("Never claim Lumora is a miracle cure.")
    t = doc.add_table(rows=1, cols=2)
    t.rows[0].cells[0].text = "Item"
    t.rows[0].cells[1].text = "Price"
    row = t.add_row()
    row.cells[0].text = "Desk Lamp"
    row.cells[1].text = "priced at $199"

    buf = io.BytesIO()
    doc.save(buf)
    docx_bytes = buf.getvalue()

    pages = parse_docx(docx_bytes)
    assert len(pages) == 1
    assert pages[0].section == "Branding Section"
    assert "Never claim Lumora" in pages[0].text
    assert "priced at $199" in pages[0].text

