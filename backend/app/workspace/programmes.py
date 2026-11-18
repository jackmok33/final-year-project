"""Create private programmes and version their admission criteria."""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.api import ApiError
from app.audit import record_audit
from app.auth.permissions import active_account, owned_programme
from app.models import Programme, StoredRubric
from app.transactions import transaction
from app.workspace.schemas import CriteriaUpdate

MANDATORY_RULE = "Relevant undergraduate qualification"


def check_programme_access(
    sessions: sessionmaker[Session], subject: str, programme_id: str
) -> None:
    with transaction(sessions) as session:
        owned_programme(session, active_account(session, subject, tutor=True), programme_id)


def create_programme(sessions: sessionmaker[Session], subject: str, name: str) -> dict:
    name = name.strip()
    if not 1 <= len(name) <= 100:
        raise ApiError(422, "PROGRAMME_NAME_INVALID", "Enter a course name of 1 to 100 characters.")
    with transaction(sessions) as session:
        actor = active_account(session, subject, tutor=True, write=True)
        if session.scalar(
            select(Programme.id).where(
                Programme.created_by == actor.id, func.lower(Programme.name) == name.lower()
            )
        ):
            raise ApiError(
                409, "PROGRAMME_NAME_EXISTS", "You already have a course with this name."
            )
        year = datetime.now(UTC).year
        programme_id, rubric_id = str(uuid4()), str(uuid4())
        programme = Programme(
            id=programme_id,
            name=name,
            code="COURSE-" + programme_id.upper(),
            year=f"{year} / {(year + 1) % 100:02d}",
            created_by=actor.id,
            description="Initial criteria are illustrative, not UCL admissions policy.",
        )
        session.add(programme)
        session.flush()
        session.add(
            StoredRubric(
                id=rubric_id,
                programme_id=programme.id,
                version="1.0",
                criteria={
                    "weights": {"academic": 40, "cv": 25, "statement": 25, "references": 10},
                    "rejectBelow": 60,
                    "offerFrom": 80,
                    "margin": 3,
                    "mandatoryRule": MANDATORY_RULE,
                },
            )
        )
        session.flush()
        programme.active_rubric_id = rubric_id
        record_audit(session, actor, "Create programme workspace", programme.id)
    return {"id": programme_id}


def save_criteria(
    sessions: sessionmaker[Session], subject: str, programme_id: str, draft: CriteriaUpdate
) -> dict:
    with transaction(sessions) as session:
        actor = active_account(session, subject, tutor=True)
        programme = owned_programme(session, actor, programme_id, write=True)
        active = (
            session.get(StoredRubric, programme.active_rubric_id)
            if programme.active_rubric_id
            else None
        )
        if active is None or active.id != draft.expected_id:
            raise ApiError(
                409, "CRITERIA_CHANGED", "The active criteria changed. Reload before editing."
            )
        if draft.mandatory_rule != active.criteria["mandatoryRule"]:
            raise ApiError(
                422, "MANDATORY_RULE_FIXED", "The mandatory academic rule cannot be changed."
            )
        value = draft.model_dump(by_alias=True, exclude={"expected_id"})
        if value == active.criteria:
            raise ApiError(422, "CRITERIA_UNCHANGED", "Change numeric criteria before saving.")
        versions = session.scalars(
            select(StoredRubric.version).where(StoredRubric.programme_id == programme.id)
        ).all()
        numeric = [
            tuple(map(int, v.split(".")))
            for v in versions
            if len(v.split(".")) == 2 and all(p.isdigit() for p in v.split("."))
        ]
        major, minor = max(numeric, default=(1, -1))
        saved = StoredRubric(
            programme_id=programme.id, version=f"{major}.{minor + 1}", criteria=value
        )
        session.add(saved)
        session.flush()
        programme.active_rubric_id = saved.id
        record_audit(session, actor, "Save admission criteria", saved.id)
        result = {"id": saved.id}
    return result
