"""Short, synthetic CV pages for the specialist and orchestration tests."""

from io import BytesIO

from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

PROJECT = "Built a Python dashboard for bicycle hire data."
WORK = "Internship: Wrote SQL checks for stock reports."
CV_PAGES = (("SYNTHETIC CV", "Projects", PROJECT), ("Work experience", WORK))


def cv_pdf(pages: tuple[tuple[str, ...], ...] = CV_PAGES) -> bytes:
    writer = PdfWriter()
    for lines in pages:
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
        operators = "".join(
            f"1 0 0 1 62 {690 - index * 24} Tm ({line}) Tj\n" for index, line in enumerate(lines)
        )
        stream = DecodedStreamObject()
        stream.set_data(f"BT /F1 19 Tf\n{operators}ET".encode("ascii"))
        page.replace_contents(stream)
    output = BytesIO()
    writer.write(output)
    return output.getvalue()
