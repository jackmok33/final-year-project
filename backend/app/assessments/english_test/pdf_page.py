"""Render a single IELTS page in an isolated, bounded child process."""

import base64
import io
import json
import re
import resource
import sys
from contextlib import closing

from app.documents.limits import MAX_PDF_BYTES
from app.inference.client import MAX_IMAGE_BYTES

MAX_TEXT_CHARACTERS = 4800
SCORE_LABELS = ("Listening", "Reading", "Writing", "Speaking", "Overall")


def score_crop(page):
    """Crop only when all score labels locate one compact block of the page."""
    if page.get_rotation() != 0:
        return (0, 0, 0, 0)
    width, height = page.get_size()
    boxes = []
    with closing(page.get_textpage()) as text_page:
        for label in SCORE_LABELS:
            with closing(text_page.search(label, match_whole_word=True)) as hits:
                hit = hits.get_next()
                if hit is None or hits.get_next() is not None:
                    return (0, 0, 0, 0)
                index, _ = hit
                boxes.append(text_page.get_charbox(index))
    bottom = min(box[1] for box in boxes)
    top = max(box[3] for box in boxes)
    if top - bottom > height / 4:
        return (0, 0, 0, 0)
    # Include values on either side of the label line and the full width of the table.
    padding = min(width / 5, height / 7)
    return (0, max(0, bottom - padding), 0, max(0, height - top - padding))


def prepare_report(contents: bytes) -> tuple[str, bytes]:
    from pypdf import PdfReader
    from pypdfium2 import PdfDocument

    reader = PdfReader(io.BytesIO(contents), strict=True)
    if reader.is_encrypted or len(reader.pages) != 1:
        raise ValueError("Expected a single unencrypted page.")
    with_text = reader.pages[0].extract_text(extraction_mode="layout") or ""
    text = re.sub(r"[^\S\n]+", " ", with_text[: MAX_TEXT_CHARACTERS * 4]).strip()
    with PdfDocument(contents) as document, closing(document[0]) as page:
        width, height = page.get_size()
        crop = score_crop(page) if text and re.search(r"\bIELTS\b", text, re.I) else (0, 0, 0, 0)
        left, bottom, right, top = crop
        longest_edge = max(width - left - right, height - bottom - top)
        with closing(page.render(scale=1023 / longest_edge, crop=crop)) as bitmap:
            with bitmap.to_pil().convert("L") as image:
                output = io.BytesIO()
                image.save(output, format="PNG")
    png = output.getvalue()
    if len(png) > MAX_IMAGE_BYTES:
        raise ValueError("Rendered page exceeds the inference image limit.")
    return text[:MAX_TEXT_CHARACTERS], png


def main() -> None:
    resource.setrlimit(resource.RLIMIT_CPU, (8, 8))
    if sys.platform == "linux":
        resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
    contents = sys.stdin.buffer.read(MAX_PDF_BYTES + 1)
    if not contents or len(contents) > MAX_PDF_BYTES:
        raise ValueError("PDF exceeds the preparation limit.")
    text, png = prepare_report(contents)
    print(json.dumps({"text": text, "png": base64.b64encode(png).decode("ascii")}))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        sys.exit(1)
