"""Database checks for active accounts and owned records, with transaction row locks."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api import ApiError
from app.models import Application, Programme, User


def active_account(
    session: Session, subject: str, *, tutor: bool = False, write: bool = False
) -> User:
    user = session.get(User, subject, with_for_update={"read": not write})
    if user is None or not user.active:
        raise ApiError(403, "ACCOUNT_INACTIVE", "An active account is required.")
    if tutor and not user.is_tutor:
        raise ApiError(403, "ACCESS_DENIED", "This account cannot perform that operation.")
    return user


def owned_programme(
    session: Session, actor: User, programme_id: str, *, write: bool = False
) -> Programme:
    if not actor.is_tutor:
        raise ApiError(403, "ACCESS_DENIED", "Tutor access is required.")
    row = session.scalar(
        select(Programme)
        .where(Programme.id == programme_id, Programme.created_by == actor.id)
        .with_for_update(read=not write)
    )
    if row is None:
        raise ApiError(404, "PROGRAMME_NOT_FOUND", "Programme not found.")
    return row


def owned_application(
    session: Session, user_id: str, application_id: str, *, write: bool = False
) -> Application:
    application = session.scalar(
        select(Application)
        .join(Programme, Programme.id == Application.programme_id)
        .where(Application.id == application_id, Programme.created_by == user_id)
        .with_for_update(read=True, of=Programme if write else [Programme, Application])
    )
    if application is None:
        # Missing and inaccessible objects have the same response.
        raise ApiError(404, "APPLICATION_NOT_FOUND", "Application not found.")
    if write:
        application = session.scalar(
            select(Application)
            .where(
                Application.id == application_id,
                Application.programme_id == application.programme_id,
            )
            .with_for_update()
        )
        if application is None:
            raise ApiError(404, "APPLICATION_NOT_FOUND", "Application not found.")
    return application
