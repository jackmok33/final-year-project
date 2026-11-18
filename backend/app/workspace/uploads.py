"""Read and validate the multipart manifest and its original PDF files."""

import json

import anyio
from fastapi import Request
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException, MultiPartParser

from app.api import ApiError
from app.documents.limits import MAX_PDF_BYTES
from app.documents.pdf_validation import ValidatedPdf, validate_filename, validate_pdf
from app.workspace.schemas import ApplicationManifest, BatchManifest


async def read_upload(
    request: Request, *, batch: bool
) -> tuple[ApplicationManifest | BatchManifest, list[tuple[str, ValidatedPdf]]]:
    if not request.headers.get("content-type", "").lower().startswith("multipart/form-data;"):
        raise ApiError(415, "UPLOAD_MEDIA_TYPE", "Send multipart form data.")

    async def bounded_stream():
        total = 0
        with anyio.fail_after(120):
            async for chunk in request.stream():
                total += len(chunk)
                if total > 201 * 1024 * 1024:
                    raise MultiPartException("Upload exceeded its limit.")
                yield chunk

    try:
        # The pinned Starlette parser closes every spool file even if the stream fails.
        form = await MultiPartParser(
            request.headers,
            bounded_stream(),
            max_files=1000,
            max_fields=1,
            max_part_size=1024 * 1024,
        ).parse()
    except TimeoutError:
        raise ApiError(408, "UPLOAD_TIMEOUT", "The upload exceeded its deadline.") from None
    except MultiPartException:
        raise ApiError(
            413, "UPLOAD_LIMIT", "The multipart upload is invalid or exceeds its limit."
        ) from None
    try:
        values = form.getlist("manifest")
        parts = form.getlist("file")
        if (
            len(values) != 1
            or not isinstance(values[0], str)
            or not parts
            or any(not isinstance(part, UploadFile) for part in parts)
            or len(form.multi_items()) != len(parts) + 1
        ):
            raise ValueError
        manifest = (BatchManifest if batch else ApplicationManifest).model_validate(
            json.loads(values[0])
        )
        applications = manifest.applications if batch else [manifest]
        indices = [part.file_index for applicant in applications for part in applicant.documents]
        if sorted(indices) != list(range(len(parts))):
            raise ValueError
        if batch and (
            "/" in manifest.filename
            or "\\" in manifest.filename
            or not manifest.filename.lower().endswith(".zip")
        ):
            raise ValueError
        if batch and len({item.candidate.strip().lower() for item in applications}) != len(
            applications
        ):
            raise ValueError
        prepared, total = [], 0
        deadline = anyio.current_time() + 180
        for part in parts:
            if anyio.current_time() >= deadline:
                raise ApiError(
                    408,
                    "VALIDATION_TIMEOUT",
                    "The batch could not be validated within its deadline.",
                )
            filename = validate_filename(part.filename or "")
            contents = await part.read(MAX_PDF_BYTES + 1)
            total += len(contents)
            if total > 200 * 1024 * 1024:
                raise ApiError(413, "UPLOAD_LIMIT", "Application files must not exceed 200 MiB.")
            pdf = await run_in_threadpool(validate_pdf, contents)
            prepared.append((filename, pdf))
        return manifest, prepared
    except (ValueError, ValidationError):
        raise ApiError(
            422, "UPLOAD_MANIFEST_INVALID", "The applicant/file manifest is invalid."
        ) from None
    finally:
        await form.close()
