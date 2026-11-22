"""Render a single IELTS page in an isolated, bounded child process."""

import io
import json
import re
import sys
from contextlib import closing

from app.assessments.pdf_preparation import (
    FULL_PAGE,
    MAX_TEXT_CHARACTERS,
    encode_page,
    page_text,
    read_pdf,
    render_png,
)

SCORE_LABELS = ("Listening", "Reading", "Writing", "Speaking", "Overall")


def score_crop(page):
    """Crop only when all score labels locate one compact block of the page."""
    if page.get_rotation() != 0:
        return FULL_PAGE
    width, height = page.get_size()
    boxes = []
    with closing(page.get_textpage()) as text_page:
        for label in SCORE_LABELS:
            with closing(text_page.search(label, match_whole_word=True)) as hits:
                hit = hits.get_next()
                if hit is None or hits.get_next() is not None:
                    return FULL_PAGE
                index, _ = hit
                boxes.append(text_page.get_charbox(index))
    bottom = min(box[1] for box in boxes)
    top = max(box[3] for box in boxes)
    if top - bottom > height / 4:
        return FULL_PAGE
    # Include values on either side of the label line and the full width of the table.
    padding = min(width / 5, height / 7)
    return (0, max(0, bottom - padding), 0, max(0, height - top - padding))


def prepare_report(contents: bytes) -> tuple[str, bytes]:
    from pypdf import PdfReader
    from pypdfium2 import PdfDocument

    reader = PdfReader(io.BytesIO(contents), strict=True)
    if reader.is_encrypted or len(reader.pages) != 1:
        raise ValueError("Expected a single unencrypted page.")
    text = page_text(reader.pages[0], limit=MAX_TEXT_CHARACTERS * 4)
    with PdfDocument(contents) as document, closing(document[0]) as page:
        crop = score_crop(page) if re.search(r"\bIELTS\b", text, re.I) else FULL_PAGE
        return text[:MAX_TEXT_CHARACTERS], render_png(page, crop)


def main() -> None:
    print(json.dumps(encode_page(*prepare_report(read_pdf()))))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        sys.exit(1)
