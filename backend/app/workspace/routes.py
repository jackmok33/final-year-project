"""Authenticated workspace, course, account and applicant endpoints."""

import anyio
from fastapi import APIRouter, Depends, Request
from starlette.concurrency import run_in_threadpool

from app.api import ApiError
from app.dependencies import AuthenticatedSubject, DatabaseSessions, private_response
from app.workspace.schemas import (
    AccountUpdate,
    CriteriaUpdate,
    DeleteApplicationRequest,
    ProgrammeCreate,
)
from app.workspace.uploads import read_upload

router = APIRouter(prefix="/api/v1", tags=["Workspace"], dependencies=[Depends(private_response)])

# The route-local imports keep SQLAlchemy out of FastAPI startup and public diagnostics.


@router.get("/workspace")
def workspace_snapshot(request: Request, subject: AuthenticatedSubject, sessions: DatabaseSessions):
    from app.workspace.snapshot import read_workspace

    return read_workspace(sessions, subject, request.app.state.english_test_pilot)


@router.get("/me")
def me(subject: AuthenticatedSubject, sessions: DatabaseSessions):
    from app.workspace.snapshot import read_workspace

    snapshot = read_workspace(sessions, subject)
    return next(user for user in snapshot["users"] if user["id"] == subject)


@router.post("/programmes", status_code=201)
def create_programme(
    payload: ProgrammeCreate, subject: AuthenticatedSubject, sessions: DatabaseSessions
):
    from app.workspace import programmes

    return programmes.create_programme(sessions, subject, payload.name)


@router.put("/programmes/{programme_id}/criteria")
def save_criteria(
    programme_id: str,
    payload: CriteriaUpdate,
    subject: AuthenticatedSubject,
    sessions: DatabaseSessions,
):
    from app.workspace import programmes

    return programmes.save_criteria(sessions, subject, programme_id, payload)


@router.post("/accounts", status_code=201)
def create_account(
    payload: AccountUpdate, subject: AuthenticatedSubject, sessions: DatabaseSessions
):
    from app.workspace import accounts

    return accounts.save_account(sessions, subject, None, payload)


@router.put("/accounts/{account_id}")
def save_account(
    account_id: str,
    payload: AccountUpdate,
    subject: AuthenticatedSubject,
    sessions: DatabaseSessions,
):
    from app.workspace import accounts

    return accounts.save_account(sessions, subject, account_id, payload)


async def _create(programme_id: str, request: Request, subject: str, sessions, *, batch: bool):
    from app.workspace.applications import create_applications
    from app.workspace.programmes import check_programme_access

    await run_in_threadpool(check_programme_access, sessions, subject, programme_id)
    try:
        request.app.state.document_upload_slots.acquire_nowait()
    except anyio.WouldBlock:
        raise ApiError(503, "DOCUMENT_UPLOAD_BUSY", "Uploads are busy. Try again later.") from None
    try:
        manifest, files = await read_upload(request, batch=batch)
        return await run_in_threadpool(
            create_applications, sessions, subject, programme_id, manifest, files
        )
    finally:
        request.app.state.document_upload_slots.release()


@router.post("/programmes/{programme_id}/applications", status_code=201)
async def create_application(
    programme_id: str, request: Request, subject: AuthenticatedSubject, sessions: DatabaseSessions
):
    return await _create(programme_id, request, subject, sessions, batch=False)


@router.post("/programmes/{programme_id}/batches", status_code=201)
async def create_batch(
    programme_id: str, request: Request, subject: AuthenticatedSubject, sessions: DatabaseSessions
):
    return await _create(programme_id, request, subject, sessions, batch=True)


@router.delete("/applications/{application_id}")
def delete_application(
    application_id: str,
    payload: DeleteApplicationRequest,
    subject: AuthenticatedSubject,
    sessions: DatabaseSessions,
):
    from app.workspace import applications

    return applications.delete_application(sessions, subject, application_id)
