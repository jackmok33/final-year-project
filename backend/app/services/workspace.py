"""Server-owned workspace records and review history; never browser authority."""

import copy
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import func, select, text

from app.document_errors import DocumentError
from app.models import Application, AuditEvent, Document, Programme, StoredRubric, UploadBatch, User
from app.schemas import CriteriaContext, DocumentReference, MockAssessmentRequest
from app.services.documents import DocumentService
from app.services.evaluation import FIXTURES, MockEvaluationService, UnsupportedMockCase

MANDATORY_RULE = "Relevant undergraduate qualification"


def stamp(value):
    return value.isoformat()


def criteria_record(row):
    return {
        "id": row.id,
        "programmeId": row.programme_id,
        "version": row.version,
        "createdAt": stamp(row.created_at),
        **row.criteria,
    }


def document_record(row):
    return {
        "id": row.id,
        "applicationId": row.application_id,
        "type": row.document_type,
        "name": row.filename,
        "size": row.size_bytes,
        "pages": row.page_count,
        "hash": row.sha256,
    }


def application_record(row, documents):
    result = {
        "id": row.id,
        "candidate": row.candidate_reference,
        "programmeId": row.programme_id,
        "intakeYear": row.intake_year,
        "submittedAt": stamp(row.submitted_at),
        "documentIds": [doc["id"] for doc in documents if doc["applicationId"] == row.id],
        **copy.deepcopy(row.review_state),
    }
    if row.batch_id is not None:
        result["batchId"] = row.batch_id
    if row.fixture is not None:
        result["fixture"] = row.fixture
    return result


def normal_intake(value):
    import re

    value = value.strip()
    if not value or len(value) > 200:
        raise DocumentError(422, "INTAKE_INVALID", "Enter a valid intake year.")
    match = re.fullmatch(r"(\d{2}|\d{4})\s*/\s*(\d{2}|\d{4})", value)
    if match:
        start = int(match[1]) + (2000 if len(match[1]) == 2 else 0)
        end = int(match[2])
        if (
            not 1900 <= start <= 9998
            or end % 100 != (start + 1) % 100
            or (len(match[2]) == 4 and end != start + 1)
        ):
            raise DocumentError(422, "INTAKE_INVALID", "Enter a valid intake year.")
        return f"{start} / {(start + 1) % 100:02d}"
    return value


class WorkspaceService(DocumentService):
    @staticmethod
    def _actor(session, subject, *, admin=False, tutor=False, write=False):
        user = session.get(User, subject, with_for_update={"read": not write})
        if user is None or not user.active:
            raise DocumentError(403, "ACCOUNT_INACTIVE", "An active account is required.")
        if (admin and not user.is_admin) or (tutor and not user.is_tutor):
            raise DocumentError(403, "ACCESS_DENIED", "This account cannot perform that operation.")
        return user

    @staticmethod
    def _programme(session, actor, programme_id, *, write=False):
        if not actor.is_tutor:
            raise DocumentError(403, "ACCESS_DENIED", "Tutor access is required.")
        row = session.scalar(
            select(Programme)
            .where(Programme.id == programme_id, Programme.created_by == actor.id)
            .with_for_update(read=not write)
        )
        if row is None:
            raise DocumentError(404, "PROGRAMME_NOT_FOUND", "Programme not found.")
        return row

    @staticmethod
    def _audit(session, actor, action, target):
        session.add(AuditEvent(actor=actor.id, action=action, target=target))

    @staticmethod
    def _account(user, programmes):
        return {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "roles": (["tutor"] if user.is_tutor else []) + (["admin"] if user.is_admin else []),
            "programmeIds": [p.id for p in programmes if p.created_by == user.id]
            if user.is_tutor
            else [],
            "canPublishCriteria": user.can_publish_criteria and user.is_tutor,
            "active": user.active,
        }

    def snapshot(self, subject):
        with self._transaction() as session:
            session.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ"))
            actor = self._actor(session, subject)
            owned = (
                session.scalars(
                    select(Programme)
                    .where(Programme.created_by == actor.id)
                    .order_by(Programme.created_at, Programme.id)
                ).all()
                if actor.is_tutor
                else []
            )
            programme_ids = [p.id for p in owned]
            accounts = (
                session.scalars(select(User).order_by(User.created_at, User.id)).all()
                if actor.is_admin
                else [actor]
            )
            # Only administrators/the owner receive account compatibility course IDs.
            all_programmes = session.scalars(select(Programme)).all() if actor.is_admin else owned
            applications = session.scalars(
                select(Application)
                .where(Application.programme_id.in_(programme_ids))
                .order_by(Application.submitted_at, Application.id)
            ).all()
            doc_rows = session.execute(
                select(
                    Document.id,
                    Document.application_id,
                    Document.document_type,
                    Document.filename,
                    Document.size_bytes,
                    Document.page_count,
                    Document.sha256,
                )
                .where(Document.application_id.in_([a.id for a in applications]))
                .order_by(Document.position, Document.uploaded_at, Document.id)
            ).all()
            documents = [document_record(d) for d in doc_rows]
            batches = session.scalars(
                select(UploadBatch)
                .where(UploadBatch.programme_id.in_(programme_ids))
                .order_by(UploadBatch.uploaded_at, UploadBatch.id)
            ).all()
            rubrics = session.scalars(
                select(StoredRubric)
                .where(StoredRubric.programme_id.in_(programme_ids))
                .order_by(StoredRubric.created_at, StoredRubric.id)
            ).all()
            return {
                "version": 2,
                "users": [self._account(u, all_programmes) for u in accounts],
                "programmes": [
                    {
                        "id": p.id,
                        "name": p.name,
                        "code": p.code,
                        "year": p.year,
                        "department": p.department,
                        "description": p.description,
                        "createdBy": p.created_by,
                    }
                    for p in owned
                ],
                "applications": [application_record(a, documents) for a in applications],
                "documents": documents,
                "rubrics": [criteria_record(r) for r in rubrics],
                "activeRubricIds": {p.id: p.active_rubric_id for p in owned if p.active_rubric_id},
                "batches": [
                    {
                        "id": b.id,
                        "programmeId": b.programme_id,
                        "intakeYear": b.intake_year,
                        "filename": b.filename,
                        "source": b.source,
                        "uploadedAt": stamp(b.uploaded_at),
                        **({"uploadedBy": b.uploaded_by} if b.uploaded_by else {}),
                    }
                    for b in batches
                ],
                "audit": [],
                "modelAvailable": all(p.model_available for p in owned),
                "subject": actor.id,
            }

    def programme_access(self, subject, programme_id):
        with self._transaction() as session:
            self._programme(session, self._actor(session, subject, tutor=True), programme_id)

    def create_programme(self, subject, name):
        name = name.strip()
        if not 1 <= len(name) <= 100:
            raise DocumentError(
                422, "PROGRAMME_NAME_INVALID", "Enter a course name of 1 to 100 characters."
            )
        with self._transaction() as session:
            actor = self._actor(session, subject, tutor=True, write=True)
            if session.scalar(
                select(Programme.id).where(
                    Programme.created_by == actor.id, func.lower(Programme.name) == name.lower()
                )
            ):
                raise DocumentError(
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
            self._audit(session, actor, "Create programme workspace", programme.id)
        return {"id": programme_id}

    def save_criteria(self, subject, programme_id, draft):
        with self._transaction() as session:
            actor = self._actor(session, subject, tutor=True)
            programme = self._programme(session, actor, programme_id, write=True)
            active = (
                session.get(StoredRubric, programme.active_rubric_id)
                if programme.active_rubric_id
                else None
            )
            if active is None or active.id != draft.expected_id:
                raise DocumentError(
                    409, "CRITERIA_CHANGED", "The active criteria changed. Reload before editing."
                )
            if draft.mandatory_rule != active.criteria["mandatoryRule"]:
                raise DocumentError(
                    422, "MANDATORY_RULE_FIXED", "The mandatory academic rule cannot be changed."
                )
            value = draft.model_dump(by_alias=True, exclude={"expected_id"})
            if value == active.criteria:
                raise DocumentError(
                    422, "CRITERIA_UNCHANGED", "Change numeric criteria before saving."
                )
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
            self._audit(session, actor, "Save admission criteria", saved.id)
            result = {"id": saved.id}
        return result

    def save_account(self, subject, account_id, draft):
        with self._transaction() as session:
            # A shared, fixed row-lock order prevents concurrent last-admin removal.
            users = session.scalars(select(User).order_by(User.id).with_for_update()).all()
            actor = next((u for u in users if u.id == subject), None)
            if actor is None or not actor.active or not actor.is_admin:
                raise DocumentError(403, "ACCESS_DENIED", "Administrator access is required.")
            target = next((u for u in users if u.id == account_id), None)
            if account_id and target is None:
                raise DocumentError(404, "ACCOUNT_NOT_FOUND", "Account not found.")
            if (
                target
                and target.active
                and target.is_admin
                and (not draft.active or "admin" not in draft.roles)
                and not any(u.active and u.is_admin and u.id != target.id for u in users)
            ):
                raise DocumentError(409, "LAST_ADMIN", "Keep at least one active administrator.")
            email = draft.email.strip().lower()
            if any(u.email == email and (target is None or u.id != target.id) for u in users):
                raise DocumentError(
                    409, "EMAIL_EXISTS", "This email is already assigned to an account."
                )
            if target is None:
                target = User(id=str(uuid4()))
                session.add(target)
            target.name, target.email = draft.name.strip(), email
            if not target.name:
                raise DocumentError(422, "ACCOUNT_NAME_INVALID", "Enter an account name.")
            target.active, target.is_tutor, target.is_admin = (
                draft.active,
                "tutor" in draft.roles,
                "admin" in draft.roles,
            )
            target.can_publish_criteria = target.is_tutor
            self._audit(session, actor, "Save account and permissions", target.id)
            result = {"id": target.id}
        return result

    def create_applications(self, subject, programme_id, manifest, files, *, batch=False):
        intake = normal_intake(manifest.intake_year)
        applicants = manifest.applications if batch else [manifest]
        with self._transaction() as session:
            actor = self._actor(session, subject, tutor=True)
            programme = self._programme(session, actor, programme_id, write=True)
            if batch:
                target = UploadBatch(
                    programme_id=programme.id,
                    intake_year=intake,
                    filename=manifest.filename,
                    source="zip",
                    uploaded_by=actor.id,
                )
                session.add(target)
                session.flush()
            elif manifest.batch_id:
                target = session.scalar(
                    select(UploadBatch).where(
                        UploadBatch.id == manifest.batch_id,
                        UploadBatch.programme_id == programme.id,
                        UploadBatch.intake_year == intake,
                    )
                )
                if target is None:
                    raise DocumentError(
                        404, "BATCH_NOT_FOUND", "Select a batch in the same programme and intake."
                    )
            else:
                target = session.scalar(
                    select(UploadBatch).where(
                        UploadBatch.programme_id == programme.id,
                        UploadBatch.intake_year == intake,
                        UploadBatch.source == "existing",
                    )
                )
                if target is None:
                    target = UploadBatch(
                        programme_id=programme.id,
                        intake_year=intake,
                        filename="",
                        source="existing",
                        uploaded_by=actor.id,
                    )
                    session.add(target)
                    session.flush()
            first_id = None
            for item in applicants:
                name = item.candidate.strip()
                if not name:
                    raise DocumentError(422, "CANDIDATE_REQUIRED", "Enter an applicant identifier.")
                app = Application(
                    programme_id=programme.id,
                    candidate_reference=name,
                    intake_year=intake,
                    batch_id=target.id,
                    created_by=actor.id,
                )
                session.add(app)
                session.flush()
                first_id = first_id or app.id
                singleton, pages = set(), 0
                for position, part in enumerate(item.documents):
                    filename, pdf = files[part.file_index]
                    if part.type != "reference" and part.type in singleton:
                        raise DocumentError(
                            422, "DUPLICATE_DOCUMENT", "Upload one document per type."
                        )
                    singleton.add(part.type)
                    pages += pdf.page_count
                    if pages > 100:
                        raise DocumentError(
                            422,
                            "APPLICATION_PAGE_LIMIT",
                            "An application cannot contain more than 100 pages.",
                        )
                    session.add(
                        Document(
                            application_id=app.id,
                            document_type=part.type,
                            filename=filename,
                            content_type="application/pdf",
                            size_bytes=len(pdf.contents),
                            page_count=pdf.page_count,
                            position=position,
                            sha256=pdf.sha256,
                            pdf_bytes=pdf.contents,
                        )
                    )
                self._audit(session, actor, "Create application", app.id)
            result = {"id": target.id if batch else first_id, "batchId": target.id}
        return result

    def delete_application(self, subject, application_id):
        with self._transaction() as session:
            actor = self._actor(session, subject, tutor=True)
            app = self._owned_application(session, actor.id, application_id, write=True)
            session.delete(app)
            self._audit(session, actor, "Delete application and documents", application_id)
        return {}

    @staticmethod
    def _ready_run(application, run_id):
        runs = application.review_state["runs"]
        run = runs[-1] if runs else None
        if (
            not run
            or run["id"] != run_id
            or run["status"] in {"queued", "running", "failed"}
            or any(flag["code"] == "BACKEND_UNAVAILABLE" for flag in run["flags"])
        ):
            raise DocumentError(
                409,
                "ASSESSMENT_NOT_READY",
                "Review the latest successful assessment before saving.",
            )
        return run

    def _evaluation(self, session, application, grade):
        programme = session.get(Programme, application.programme_id)
        rubric = (
            session.get(StoredRubric, programme.active_rubric_id)
            if programme.active_rubric_id
            else None
        )
        if (
            application.fixture != FIXTURES.get(application.id)
            or application.id not in FIXTURES
            or rubric is None
            or rubric.criteria["weights"].get("references", 0) > 0
        ):
            raise DocumentError(
                503,
                "ASSESSMENT_UNAVAILABLE",
                "Real document assessment is not connected yet. No scores have been generated.",
            )
        criteria = {
            **rubric.criteria,
            "id": rubric.id,
            "version": rubric.version,
            "weights": {k: v for k, v in rubric.criteria["weights"].items() if k != "references"},
        }
        documents = session.execute(
            select(Document.id, Document.document_type, Document.page_count).where(
                Document.application_id == application.id,
                Document.document_type.in_(["transcript", "cv", "statement"]),
            )
        ).all()
        try:
            request = MockAssessmentRequest(
                application_id=application.id,
                criteria=CriteriaContext.model_validate(criteria),
                documents=[
                    DocumentReference(id=d.id, type=d.document_type, pages=d.page_count)
                    for d in documents
                ],
                grade=grade,
                parent_run_id=(
                    application.review_state["runs"][-1]["id"]
                    if application.review_state["runs"]
                    else None
                ),
                model_available=programme.model_available,
            )
            return (
                MockEvaluationService()
                .evaluate(request)
                .model_dump(by_alias=True, mode="json", exclude_none=False)
            )
        except UnsupportedMockCase:
            raise DocumentError(
                503, "ASSESSMENT_UNAVAILABLE", "This case has no supported synthetic assessment."
            ) from None

    def review(self, subject, application_id, operation, payload=None):
        with self._transaction() as session:
            actor = self._actor(session, subject, tutor=True)
            application = self._owned_application(session, actor.id, application_id, write=True)
            state = copy.deepcopy(application.review_state)
            if operation == "evaluate":
                latest = state["runs"][-1] if state["runs"] else None
                if latest and latest["status"] in {"queued", "running"}:
                    raise DocumentError(
                        409, "ASSESSMENT_RUNNING", "An evaluation is already in progress."
                    )
                grade = (
                    state["corrections"][-1]["value"]
                    if state["corrections"]
                    else (latest or {}).get("extractedGrade", 74)
                )
                state["runs"].append(self._evaluation(session, application, grade))
            elif operation == "decision":
                run = self._ready_run(application, payload.run_id)
                if state["decisions"] and all(
                    state["decisions"][-1].get(key) == value
                    for key, value in {
                        "runId": run["id"],
                        "outcome": payload.outcome,
                        "reason": payload.reason.strip(),
                    }.items()
                ):
                    return {}
                state["decisions"].append(
                    {
                        "id": str(uuid4()),
                        "runId": run["id"],
                        "recommendation": run["recommendation"],
                        "outcome": payload.outcome,
                        "reason": payload.reason.strip(),
                        "actor": actor.id,
                        "at": stamp(datetime.now(UTC)),
                    }
                )
            else:
                run = self._ready_run(application, payload.run_id)
                document = session.get(Document, payload.document_id)
                if (
                    document is None
                    or document.application_id != application.id
                    or document.document_type != "transcript"
                    or payload.page > document.page_count
                    or not payload.reason.strip()
                ):
                    raise DocumentError(
                        422,
                        "CORRECTION_INVALID",
                        "Enter a valid transcript page and correction reason.",
                    )
                next_run = self._evaluation(session, application, payload.value)
                state["corrections"].append(
                    {
                        "id": str(uuid4()),
                        "runId": run["id"],
                        "original": run["extractedGrade"],
                        "value": payload.value,
                        "reason": payload.reason.strip(),
                        "citation": {
                            "documentId": document.id,
                            "page": payload.page,
                            "claim": f"Corrected grade: {payload.value}%",
                        },
                        "actor": actor.id,
                        "at": stamp(datetime.now(UTC)),
                    }
                )
                state["runs"].append(next_run)
            application.review_state = state
            self._audit(session, actor, operation, application.id)
        return {}
