"""Administrator changes to accounts, roles and active status."""

from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.api import ApiError
from app.audit import record_audit
from app.models import User
from app.transactions import transaction
from app.workspace.schemas import AccountUpdate


def save_account(
    sessions: sessionmaker[Session], subject: str, account_id: str | None, draft: AccountUpdate
) -> dict:
    with transaction(sessions) as session:
        # A shared, fixed row-lock order prevents concurrent last-admin removal.
        users = session.scalars(select(User).order_by(User.id).with_for_update()).all()
        actor = next((u for u in users if u.id == subject), None)
        if actor is None or not actor.active or not actor.is_admin:
            raise ApiError(403, "ACCESS_DENIED", "Administrator access is required.")
        target = next((u for u in users if u.id == account_id), None)
        if account_id and target is None:
            raise ApiError(404, "ACCOUNT_NOT_FOUND", "Account not found.")
        if (
            target
            and target.active
            and target.is_admin
            and (not draft.active or "admin" not in draft.roles)
            and not any(u.active and u.is_admin and u.id != target.id for u in users)
        ):
            raise ApiError(409, "LAST_ADMIN", "Keep at least one active administrator.")
        email = draft.email.strip().lower()
        if any(u.email == email and (target is None or u.id != target.id) for u in users):
            raise ApiError(409, "EMAIL_EXISTS", "This email is already assigned to an account.")
        if target is None:
            target = User(id=str(uuid4()))
            session.add(target)
        target.name, target.email = draft.name.strip(), email
        if not target.name:
            raise ApiError(422, "ACCOUNT_NAME_INVALID", "Enter an account name.")
        target.active, target.is_tutor, target.is_admin = (
            draft.active,
            "tutor" in draft.roles,
            "admin" in draft.roles,
        )
        target.can_publish_criteria = target.is_tutor
        record_audit(session, actor, "Save account and permissions", target.id)
        result = {"id": target.id}
    return result
