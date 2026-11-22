"""Synthetic single-page IELTS examples shared by backend and browser tests."""

from io import BytesIO

from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

BANDS = {"overall": 7.0, "listening": 7.5, "reading": 7.0, "writing": 6.5, "speaking": 7.0}
RESULT = {"test_type": "IELTS Academic", "test_date": "2026-01-15", **BANDS}


def english_pdf(*, scan: bool = False) -> bytes:
    lines = (
        "IELTS Academic",
        "Synthetic Test Report Form",
        "Test date: 2026-01-15",
        *(f"{key.capitalize()}: {value:.1f}" for key, value in BANDS.items()),
    )
    output = BytesIO()
    if scan:
        with Image.new("RGB", (720, 840), "white") as image:
            draw = ImageDraw.Draw(image)
            font = ImageFont.load_default(size=34)
            for index, line in enumerate(lines):
                draw.text((90, 120 + index * 65), line, fill="black", font=font)
            image.save(output, "PDF", creationDate="D:20260115000000Z", modDate="D:20260115000000Z")
    else:
        writer = PdfWriter()
        page = writer.add_blank_page(width=612, height=792)
        page[NameObject("/Resources")] = DictionaryObject(
            {
                NameObject("/Font"): DictionaryObject(
                    {
                        NameObject("/F1"): DictionaryObject(
                            {
                                NameObject("/Type"): NameObject("/Font"),
                                NameObject("/Subtype"): NameObject("/Type1"),
                                NameObject("/BaseFont"): NameObject("/Helvetica"),
                            }
                        )
                    }
                )
            }
        )
        stream = DecodedStreamObject()
        operators = "".join(
            f"1 0 0 1 62 {500 - index * 27} Tm ({line}) Tj\n" for index, line in enumerate(lines)
        )
        stream.set_data(f"BT /F1 23 Tf\n{operators}ET".encode("ascii"))
        page.replace_contents(stream)
        writer.write(output)
    return output.getvalue()
