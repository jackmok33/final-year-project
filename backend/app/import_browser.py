"""Explicit, atomic one-off import. Never called by the HTTP application or startup."""

import base64
import copy
import json
from datetime import datetime
from pathlib import Path

from sqlalchemy import func, select

from app.assessments.mock import FIXTURES
from app.db import create_db_engine, session_factory
from app.documents.pdf_validation import validate_filename, validate_pdf
from app.models import Application, AuditEvent, Document, Programme, StoredRubric, UploadBatch, User
from app.workspace.schemas import CriteriaUpdate


def at(value):
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError("Migration timestamps must include their timezone.")
    return result


def import_browser_backup(path, engine):
    path = Path(path)
    if path.stat().st_size > 300 * 1024 * 1024:
        raise ValueError("The migration backup exceeds its limit.")
    backup = json.loads(path.read_text())
    data = backup["dataset"]
    if data.get("version") != 2:
        raise ValueError("Export the current version-2 browser dataset first.")
    collections = (
        "users",
        "programmes",
        "applications",
        "documents",
        "rubrics",
        "batches",
        "audit",
    )
    for key in collections:
        rows = data.get(key, [])
        if not isinstance(rows, list) or len({row["id"] for row in rows}) != len(rows):
            raise ValueError("The migration backup contains duplicate or invalid record IDs.")
    users = {row["id"] for row in data["users"]}
    programmes = {row["id"] for row in data["programmes"]}
    applications = {row["id"]: row for row in data["applications"]}
    documents = {row["id"]: row for row in data["documents"]}
    rubrics = {row["id"]: row for row in data["rubrics"]}
    batches = {row["id"]: row for row in data.get("batches", [])}
    for batch in batches.values():
        if batch["programmeId"] not in programmes or (
            batch.get("uploadedBy") is not None and batch["uploadedBy"] not in users
        ):
            raise ValueError("Invalid batch ownership relationship.")
    for programme in data["programmes"]:
        if programme.get("createdBy") not in users:
            raise ValueError("Every imported course must have a stored owner.")
        active = rubrics.get(data["activeRubricIds"].get(programme["id"]))
        if not active or active["programmeId"] != programme["id"]:
            raise ValueError("Invalid active criteria relationship.")
    for app in applications.values():
        if app["programmeId"] not in programmes or any(
            documents.get(key, {}).get("applicationId") != app["id"] for key in app["documentIds"]
        ):
            raise ValueError("Invalid application/document relationships.")
        batch = batches.get(app.get("batchId"))
        if app.get("batchId") and (
            batch is None
            or batch["programmeId"] != app["programmeId"]
            or batch["intakeYear"] != app.get("intakeYear")
        ):
            raise ValueError("Invalid applicant batch relationship.")
        if (
            len(set(app["documentIds"])) != len(app["documentIds"])
            or sum(documents[key]["pages"] for key in app["documentIds"]) > 100
        ):
            raise ValueError("Invalid applicant document count or combined page limit.")
        if app.get("fixture") is not None and FIXTURES.get(app["id"]) != app["fixture"]:
            raise ValueError("Unknown cases cannot be promoted to synthetic fixtures.")
        for run in app["runs"]:
            if (
                run["applicationId"] != app["id"]
                or rubrics.get(run["rubricId"], {}).get("programmeId") != app["programmeId"]
            ):
                raise ValueError("Invalid saved assessment relationship.")
    prepared, total = {}, 0
    for row in documents.values():
        app = applications.get(row["applicationId"])
        if not app or row["id"] not in app["documentIds"]:
            raise ValueError("An original document is not linked to its applicant.")
        validate_filename(row["name"])
        raw = base64.b64decode(backup["files"][row["id"]], validate=True)
        total += len(raw)
        if total > 200 * 1024 * 1024:
            raise ValueError("The migration PDF bytes exceed 200 MiB.")
        pdf = validate_pdf(raw)
        if pdf.sha256 != row["hash"] or pdf.page_count != row["pages"] or len(raw) != row["size"]:
            raise ValueError("An original PDF does not match its saved metadata.")
        prepared[row["id"]] = pdf
    with session_factory(engine).begin() as session:
        # Refuse conflicting records; never reset or truncate existing database tables.
        for row in data["users"]:
            user = session.get(User, row["id"])
            if user and user.email != row["email"].strip().lower():
                raise ValueError("A database account conflicts with the browser account.")
            if user is None:
                user = User(id=row["id"])
                session.add(user)
            user.name, user.email = row["name"], row["email"].strip().lower()
            user.is_tutor, user.is_admin, user.active = (
                "tutor" in row["roles"],
                "admin" in row["roles"],
                row["active"],
            )
            user.can_publish_criteria = row["canPublishCriteria"]
        session.flush()
        for row in data["programmes"]:
            programme = session.get(Programme, row["id"])
            if programme:
                if programme.active_rubric_id not in (None, data["activeRubricIds"][row["id"]]):
                    raise ValueError("Existing active criteria conflict with the browser data.")
                count = session.scalar(
                    select(func.count())
                    .select_from(Application)
                    .where(Application.programme_id == programme.id)
                )
                if programme.created_by not in (None, row["createdBy"]) or (
                    count and (programme.name != row["name"] or programme.code != row["code"])
                ):
                    raise ValueError("An existing programme conflicts with the browser data.")
            else:
                programme = Programme(id=row["id"])
                session.add(programme)
            for source, target in (
                ("name", "name"),
                ("code", "code"),
                ("year", "year"),
                ("department", "department"),
                ("description", "description"),
                ("createdBy", "created_by"),
            ):
                setattr(programme, target, row[source])
            programme.model_available = data["modelAvailable"]
        session.flush()
        for row in data["rubrics"]:
            criteria = {
                key: copy.deepcopy(row[key])
                for key in ("weights", "rejectBelow", "offerFrom", "margin", "mandatoryRule")
            }
            CriteriaUpdate.model_validate({"expectedId": row["id"], **criteria})
            existing = session.get(StoredRubric, row["id"])
            if existing and (
                existing.programme_id != row["programmeId"]
                or existing.criteria != criteria
                or existing.version != row["version"]
            ):
                raise ValueError("Existing criteria conflict with the browser version.")
            if not existing:
                session.add(
                    StoredRubric(
                        id=row["id"],
                        programme_id=row["programmeId"],
                        version=row["version"],
                        criteria=criteria,
                        created_at=at(row["createdAt"]),
                    )
                )
        session.flush()
        for programme_id, rubric_id in data["activeRubricIds"].items():
            session.get(Programme, programme_id).active_rubric_id = rubric_id
        for row in data.get("batches", []):
            values = {
                "programme_id": row["programmeId"],
                "intake_year": row["intakeYear"],
                "filename": row["filename"],
                "source": row["source"],
                "uploaded_by": row.get("uploadedBy"),
                "uploaded_at": at(row["uploadedAt"]),
            }
            existing = session.get(UploadBatch, row["id"])
            if existing and any(getattr(existing, key) != value for key, value in values.items()):
                raise ValueError("An existing batch conflicts with the browser data.")
            if not existing:
                session.add(UploadBatch(id=row["id"], **values))
        session.flush()
        for row in applications.values():
            review = {key: copy.deepcopy(row[key]) for key in ("runs", "corrections", "decisions")}
            programme = session.get(Programme, row["programmeId"])
            values = {
                "programme_id": programme.id,
                "candidate_reference": row["candidate"],
                "intake_year": row.get("intakeYear", programme.year),
                "batch_id": row.get("batchId"),
                "fixture": row.get("fixture"),
                "review_state": review,
                "submitted_at": at(row["submittedAt"]),
            }
            existing = session.get(Application, row["id"])
            if existing and any(getattr(existing, key) != value for key, value in values.items()):
                raise ValueError("An existing applicant conflicts with the browser data.")
            if not existing:
                session.add(Application(id=row["id"], created_by=programme.created_by, **values))
        session.flush()
        for row in documents.values():
            existing = session.get(Document, row["id"])
            values = {
                "application_id": row["applicationId"],
                "document_type": row["type"],
                "filename": row["name"],
                "size_bytes": row["size"],
                "page_count": row["pages"],
                "position": applications[row["applicationId"]]["documentIds"].index(row["id"]),
                "sha256": row["hash"],
                "pdf_bytes": prepared[row["id"]].contents,
                "content_type": "application/pdf",
            }
            if existing and any(getattr(existing, key) != value for key, value in values.items()):
                raise ValueError("An existing original PDF conflicts with the browser data.")
            if not existing:
                session.add(Document(id=row["id"], **values))
        for row in data["audit"]:
            values = {
                "at": at(row["at"]),
                "actor": row["actor"],
                "action": row["action"],
                "target": row["target"],
            }
            existing = session.get(AuditEvent, row["id"])
            if existing and any(getattr(existing, key) != value for key, value in values.items()):
                raise ValueError("An audit record conflicts with the browser data.")
            if not existing:
                session.add(AuditEvent(id=row["id"], **values))
    return {key: len(data.get(key, [])) for key in collections}


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("backup", type=Path)
    arguments = parser.parse_args()
    engine = create_db_engine()
    try:
        print(json.dumps(import_browser_backup(arguments.backup, engine)))
    finally:
        engine.dispose()
