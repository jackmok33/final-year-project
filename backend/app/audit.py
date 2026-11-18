"""Record attribution alongside the change in the caller's transaction."""

from sqlalchemy.orm import Session

from app.models import AuditEvent, User


def record_audit(session: Session, actor: User, action: str, target: str) -> None:
    session.add(AuditEvent(actor=actor.id, action=action, target=target))
