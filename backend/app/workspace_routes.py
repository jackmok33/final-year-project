"""Authenticated resources used by the connected Mantis frontend."""

import json
from typing import Annotated, Any

import anyio
from fastapi import APIRouter, Depends, Request, Response
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException, MultiPartParser

from app.document_dependencies import document_service, document_subject
from app.document_errors import DocumentError
from app.document_limits import MAX_PDF_BYTES
from app.schemas import (
    AccountUpdate,
    ApplicationManifest,
    BatchManifest,
    CorrectionRequest,
    CriteriaUpdate,
    DecisionRequest,
    DeleteApplicationRequest,
    ProgrammeCreate,
)
from app.services.pdf_validation import validate_filename, validate_pdf


def private_response(response: Response):
    response.headers["Cache-Control"] = "private, no-store"


router = APIRouter(prefix="/api/v1", tags=["Workspace"], dependencies=[Depends(private_response)])
Subject = Annotated[str, Depends(document_subject)]


def workspace_service(request: Request, resources: Annotated[Any, Depends(document_service)]):
    from app.services.workspace import WorkspaceService

    return WorkspaceService(request.app.state.document_sessions)


Service = Annotated[Any, Depends(workspace_service)]


@router.get("/workspace")
def workspace_snapshot(subject: Subject, service: Service):
    return service.snapshot(subject)


@router.get("/me")
def me(subject: Subject, service: Service):
    snapshot = service.snapshot(subject)
    return next(user for user in snapshot["users"] if user["id"] == subject)


@router.post("/programmes", status_code=201)
def create_programme(payload: ProgrammeCreate, subject: Subject, service: Service):
    return service.create_programme(subject, payload.name)


@router.put("/programmes/{programme_id}/criteria")
def save_criteria(programme_id: str, payload: CriteriaUpdate, subject: Subject, service: Service):
    return service.save_criteria(subject, programme_id, payload)


@router.post("/accounts", status_code=201)
def create_account(payload: AccountUpdate, subject: Subject, service: Service):
    return service.save_account(subject, None, payload)


@router.put("/accounts/{account_id}")
def save_account(account_id: str, payload: AccountUpdate, subject: Subject, service: Service):
    return service.save_account(subject, account_id, payload)


async def _multipart(request, *, batch):
    if not request.headers.get("content-type", "").lower().startswith("multipart/form-data;"):
        raise DocumentError(415, "UPLOAD_MEDIA_TYPE", "Send multipart form data.")

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
        raise DocumentError(408, "UPLOAD_TIMEOUT", "The upload exceeded its deadline.") from None
    except MultiPartException:
        raise DocumentError(
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
                raise DocumentError(
                    408,
                    "VALIDATION_TIMEOUT",
                    "The batch could not be validated within its deadline.",
                )
            filename = validate_filename(part.filename or "")
            contents = await part.read(MAX_PDF_BYTES + 1)
            total += len(contents)
            if total > 200 * 1024 * 1024:
                raise DocumentError(
                    413, "UPLOAD_LIMIT", "Application files must not exceed 200 MiB."
                )
            pdf = await run_in_threadpool(validate_pdf, contents)
            prepared.append((filename, pdf))
        return manifest, prepared
    except (ValueError, ValidationError):
        raise DocumentError(
            422, "UPLOAD_MANIFEST_INVALID", "The applicant/file manifest is invalid."
        ) from None
    finally:
        await form.close()


async def _create(programme_id, request, subject, service, *, batch):
    await run_in_threadpool(service.programme_access, subject, programme_id)
    try:
        request.app.state.document_upload_slots.acquire_nowait()
    except anyio.WouldBlock:
        raise DocumentError(
            503, "DOCUMENT_UPLOAD_BUSY", "Uploads are busy. Try again later."
        ) from None
    try:
        manifest, files = await _multipart(request, batch=batch)
        return await run_in_threadpool(
            lambda: service.create_applications(subject, programme_id, manifest, files, batch=batch)
        )
    finally:
        request.app.state.document_upload_slots.release()


@router.post("/programmes/{programme_id}/applications", status_code=201)
async def create_application(
    programme_id: str, request: Request, subject: Subject, service: Service
):
    return await _create(programme_id, request, subject, service, batch=False)


@router.post("/programmes/{programme_id}/batches", status_code=201)
async def create_batch(programme_id: str, request: Request, subject: Subject, service: Service):
    return await _create(programme_id, request, subject, service, batch=True)


@router.delete("/applications/{application_id}")
def delete_application(
    application_id: str, payload: DeleteApplicationRequest, subject: Subject, service: Service
):
    return service.delete_application(subject, application_id)


@router.post("/applications/{application_id}/evaluations")
def evaluate(application_id: str, subject: Subject, service: Service):
    return service.review(subject, application_id, "evaluate")


@router.post("/applications/{application_id}/decisions")
def decide(application_id: str, payload: DecisionRequest, subject: Subject, service: Service):
    return service.review(subject, application_id, "decision", payload)


@router.post("/applications/{application_id}/corrections")
def correct(application_id: str, payload: CorrectionRequest, subject: Subject, service: Service):
    return service.review(subject, application_id, "correction", payload)
