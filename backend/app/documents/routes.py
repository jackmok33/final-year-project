"""Original-PDF upload/list/download. No model calls or applicant assessment."""

from typing import Annotated, Any
from urllib.parse import quote

import anyio
from fastapi import APIRouter, Depends, Path, Query, Request, Response
from starlette.concurrency import run_in_threadpool
from starlette.requests import ClientDisconnect

from app.api import ApiError
from app.dependencies import AuthenticatedSubject, DatabaseSessions
from app.documents.limits import MAX_PDF_BYTES, UPLOAD_TIMEOUT_SECONDS
from app.documents.pdf_validation import validate_filename, validate_pdf
from app.documents.schemas import StoredDocument, StoredDocumentType

router = APIRouter(prefix="/api/v1", tags=["Documents"])
RecordId = Annotated[str, Path(min_length=1, max_length=200)]
PRIVATE_HEADERS = {"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}


def document_service(sessions: DatabaseSessions) -> Any:
    from app.documents.service import DocumentService

    return DocumentService(sessions)


Service = Annotated[Any, Depends(document_service)]


async def _read_pdf(request: Request) -> bytes:
    if (
        request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
        != "application/pdf"
    ):
        raise ApiError(415, "DOCUMENT_MEDIA_TYPE", "Send the original PDF as application/pdf.")
    length = request.headers.get("content-length")
    if length is not None:
        try:
            if len(length) > 20 or int(length) < 0:
                raise ValueError
            if int(length) > MAX_PDF_BYTES:
                raise ApiError(413, "DOCUMENT_SIZE_LIMIT", "PDFs must be at most 20 MiB.")
        except ValueError:
            raise ApiError(400, "DOCUMENT_LENGTH_INVALID", "Invalid content length.") from None
    body = bytearray()
    try:
        with anyio.fail_after(UPLOAD_TIMEOUT_SECONDS):
            async for chunk in request.stream():
                if len(body) + len(chunk) > MAX_PDF_BYTES:
                    raise ApiError(413, "DOCUMENT_SIZE_LIMIT", "PDFs must be at most 20 MiB.")
                body.extend(chunk)
    except TimeoutError:
        raise ApiError(
            408, "DOCUMENT_UPLOAD_TIMEOUT", "The PDF upload exceeded its deadline."
        ) from None
    except ClientDisconnect:
        raise ApiError(
            400, "DOCUMENT_UPLOAD_INTERRUPTED", "The PDF upload was interrupted."
        ) from None
    return bytes(body)


@router.post(
    "/applications/{application_id}/documents",
    response_model=StoredDocument,
    status_code=201,
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {"application/pdf": {"schema": {"type": "string", "format": "binary"}}},
        }
    },
)
async def upload_document(
    application_id: RecordId,
    request: Request,
    response: Response,
    subject: AuthenticatedSubject,
    service: Service,
    document_type: Annotated[StoredDocumentType, Query(alias="documentType")],
    filename: Annotated[str, Query(min_length=1, max_length=255)],
) -> StoredDocument:
    filename = validate_filename(filename)
    await run_in_threadpool(service.check_access, subject, application_id)
    try:
        request.app.state.document_upload_slots.acquire_nowait()
    except anyio.WouldBlock:
        raise ApiError(
            503, "DOCUMENT_UPLOAD_BUSY", "Document uploads are busy. Try again later."
        ) from None
    try:
        contents = await _read_pdf(request)
        pdf = await run_in_threadpool(validate_pdf, contents)
        result = await run_in_threadpool(
            service.upload, subject, application_id, document_type, filename, pdf
        )
    finally:
        request.app.state.document_upload_slots.release()
    response.headers.update(PRIVATE_HEADERS)
    response.headers["Location"] = "/api/v1/documents/" + result.id
    return result


@router.get("/applications/{application_id}/documents", response_model=list[StoredDocument])
def list_documents(
    application_id: RecordId, response: Response, subject: AuthenticatedSubject, service: Service
) -> list[StoredDocument]:
    response.headers.update(PRIVATE_HEADERS)
    return service.list_documents(subject, application_id)


@router.get(
    "/documents/{document_id}",
    response_class=Response,
    responses={
        200: {"content": {"application/pdf": {"schema": {"type": "string", "format": "binary"}}}}
    },
)
def download_document(
    document_id: RecordId, subject: AuthenticatedSubject, service: Service
) -> Response:
    document, contents = service.download(subject, document_id)
    filename = quote(document.filename, safe="")
    return Response(
        contents,
        media_type="application/pdf",
        headers={
            **PRIVATE_HEADERS,
            "Content-Disposition": "attachment; filename*=UTF-8''" + filename,
        },
    )
