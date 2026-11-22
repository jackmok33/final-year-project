"""Queue owned checks, claim work in short transactions, and project status."""

import hashlib
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, tuple_, update
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.orm import load_only

from app.api import ApiError
from app.assessments.english_test.config import PilotConfig
from app.assessments.english_test.schemas import (
    PROMPT_VERSION,
    RULE_VERSION,
    EligibilityResult,
)
from app.audit import record_audit
from app.auth.permissions import active_account, owned_application
from app.models import Document, EnglishTestCheck
from app.transactions import transaction

LEASE_DURATION = timedelta(seconds=150)
ACTIVE = ("queued", "running")


def expire_checks(session, now: datetime, application_id: str | None = None) -> None:
    statement = update(EnglishTestCheck).where(
        EnglishTestCheck.status == "running", EnglishTestCheck.lease_until <= now
    )
    if application_id is not None:
        statement = statement.where(EnglishTestCheck.application_id == application_id)
    session.execute(statement.values(status="failed", lease_until=None, error="interrupted"))


def enqueue(sessions, subject: str, application_id: str, pilot: PilotConfig) -> dict:
    with transaction(sessions) as session:
        actor = active_account(session, subject, tutor=True)
        application = owned_application(session, actor.id, application_id, write=True)
        document = session.execute(
            select(Document.id, Document.sha256).where(
                Document.application_id == application.id, Document.document_type == "english_test"
            )
        ).one_or_none()
        if document is None:
            raise ApiError(
                422, "ENGLISH_TEST_MISSING", "Upload an English test PDF before checking."
            )
        if document.sha256 not in pilot.document_hashes:
            raise ApiError(
                403, "ENGLISH_TEST_PILOT_ONLY", "This report is outside the synthetic pilot."
            )
        expire_checks(session, datetime.now(UTC), application.id)
        active = session.execute(
            select(EnglishTestCheck.id, EnglishTestCheck.status).where(
                EnglishTestCheck.application_id == application.id,
                EnglishTestCheck.status.in_(ACTIVE),
            )
        ).one_or_none()
        if active is not None:
            return {"id": active.id, "status": active.status}
        check = EnglishTestCheck(
            application_id=application.id,
            requested_by=actor.id,
            document_id=document.id,
            document_hash=document.sha256,
            created_at=datetime.now(UTC),
            status="queued",
            prompt_version=PROMPT_VERSION,
            model_version=pilot.model_version,
            rule_version=RULE_VERSION,
        )
        session.add(check)
        session.flush()
        record_audit(session, actor, "english_test_check", application.id)
        return {"id": check.id, "status": check.status}


def claim(sessions) -> EnglishTestCheck | None:
    with transaction(sessions) as session:
        now = datetime.now(UTC)
        expire_checks(session, now)
        check = session.scalar(
            select(EnglishTestCheck)
            .where(EnglishTestCheck.status == "queued")
            .order_by(EnglishTestCheck.created_at, EnglishTestCheck.id)
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if check is not None:
            check.status = "running"
            check.lease_until = now + LEASE_DURATION
        return check


def load_report(sessions, check: EnglishTestCheck, pilot: PilotConfig) -> tuple[bytes, int]:
    if (
        check.document_hash not in pilot.document_hashes
        or check.model_version != pilot.model_version
        or check.prompt_version != PROMPT_VERSION
        or check.rule_version != RULE_VERSION
    ):
        raise ApiError(
            403, "ENGLISH_TEST_PILOT_CHANGED", "Start a new check with the active pilot settings."
        )
    with transaction(sessions) as session:
        active_account(session, check.requested_by, tutor=True)
        owned_application(session, check.requested_by, check.application_id)
        document = session.scalar(
            select(Document)
            .where(
                Document.id == check.document_id,
                Document.application_id == check.application_id,
                Document.document_type == "english_test",
                Document.sha256 == check.document_hash,
            )
            .options(load_only(Document.pdf_bytes, Document.page_count))
        )
        if (
            document is None
            or hashlib.sha256(document.pdf_bytes).hexdigest() != check.document_hash
        ):
            raise ApiError(
                422, "ENGLISH_TEST_SOURCE_CHANGED", "Upload the expected synthetic report."
            )
        return document.pdf_bytes, document.page_count


def finish(
    sessions,
    check: EnglishTestCheck,
    *,
    outcome: EligibilityResult | None = None,
    error: str | None = None,
) -> None:
    with transaction(sessions) as session:
        session.execute(
            update(EnglishTestCheck)
            .where(
                EnglishTestCheck.id == check.id,
                EnglishTestCheck.status == "running",
                EnglishTestCheck.lease_until == check.lease_until,
                EnglishTestCheck.lease_until > datetime.now(UTC),
            )
            .values(
                status="completed" if outcome is not None else "failed",
                lease_until=None,
                result=outcome.model_dump(by_alias=True, mode="json") if outcome else None,
                error=error,
            )
        )


def latest_checks(session, documents: list[dict], pilot: PilotConfig) -> dict[str, dict | None]:
    eligible = {
        doc["applicationId"]: doc["id"]
        for doc in documents
        if doc["type"] == "english_test" and doc["hash"] in pilot.document_hashes
    }
    if not eligible:
        return {}
    checks = session.scalars(
        select(EnglishTestCheck)
        .where(
            tuple_(EnglishTestCheck.application_id, EnglishTestCheck.document_id).in_(
                list(eligible.items())
            ),
        )
        .ext(distinct_on(EnglishTestCheck.application_id))
        .order_by(
            EnglishTestCheck.application_id,
            EnglishTestCheck.created_at.desc(),
            EnglishTestCheck.id.desc(),
        )
    )
    result = dict.fromkeys(eligible)
    now = datetime.now(UTC)
    for check in checks:
        expired = check.status == "running" and check.lease_until <= now
        result[check.application_id] = {
            "id": check.id,
            "status": "failed" if expired else check.status,
            "documentId": check.document_id,
            "page": 1,
            "ruleVersion": check.rule_version,
            "result": check.result,
            "error": "interrupted" if expired else check.error,
        }
    return result
