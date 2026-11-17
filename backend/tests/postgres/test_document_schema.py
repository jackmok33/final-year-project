import pytest
from sqlalchemy import delete, inspect, select
from sqlalchemy.exc import IntegrityError

from app.models import Application, Document

pytestmark = pytest.mark.postgres
SINGLETON_TYPES = ("transcript", "cv", "statement", "application_form", "english_test")


@pytest.mark.parametrize("document_type", (*SINGLETON_TYPES, "reference"))
def test_all_document_categories_preserve_original_bytes(
    db_session, document_values, document_type
):
    document = Document(**(document_values | {"document_type": document_type}))
    db_session.add(document)
    db_session.commit()
    document_id = document.id
    db_session.expunge_all()
    stored = db_session.get(Document, document_id)
    assert stored.document_type == document_type
    for field, value in document_values.items():
        if field != "document_type":
            assert getattr(stored, field) == value


@pytest.mark.parametrize("document_type", SINGLETON_TYPES)
def test_singleton_document_types_reject_duplicates_in_the_same_application(
    db_session, document_values, document_type
):
    values = document_values | {"document_type": document_type}
    db_session.add(Document(**values))
    db_session.commit()
    db_session.add(Document(**(values | {"filename": "another.pdf"})))
    with pytest.raises(IntegrityError) as error:
        db_session.flush()
    assert error.value.orig.diag.constraint_name == "uq_documents_application_type"


@pytest.mark.parametrize("document_type", SINGLETON_TYPES)
def test_singleton_document_types_can_be_shared_across_applications(
    db_session, document_values, document_type
):
    application = Application(
        programme_id="programme-1", candidate_reference="Another applicant", created_by="tutor-a"
    )
    db_session.add(application)
    db_session.flush()
    values = document_values | {"document_type": document_type}
    db_session.add_all(
        [Document(**values), Document(**(values | {"application_id": application.id}))]
    )
    db_session.commit()
    assert len(db_session.scalars(select(Document)).all()) == 2


def test_multiple_references_round_trip_and_cascade_with_their_application(
    db_session, document_values
):
    # Filenames/hashes are metadata, not identifiers; separate references have their own IDs.
    values = document_values | {"document_type": "reference"}
    references = [Document(**values), Document(**values)]
    db_session.add_all(references)
    db_session.commit()
    assert references[0].id != references[1].id
    db_session.expunge_all()
    stored = db_session.scalars(select(Document)).all()
    assert len(stored) == 2
    assert all(document.pdf_bytes == document_values["pdf_bytes"] for document in stored)
    db_session.execute(delete(Application).where(Application.id == values["application_id"]))
    db_session.commit()
    assert db_session.scalars(select(Document)).all() == []


def test_changing_a_reference_to_an_existing_singleton_type_is_rejected(
    db_session, document_values
):
    singleton = Document(**(document_values | {"document_type": "english_test"}))
    reference = Document(**(document_values | {"document_type": "reference"}))
    db_session.add_all([singleton, reference])
    db_session.commit()
    reference.document_type = "english_test"
    with pytest.raises(IntegrityError) as error:
        db_session.flush()
    assert error.value.orig.diag.constraint_name == "uq_documents_application_type"


def test_application_lookup_index_covers_references_too(db_engine):
    indexes = {index["name"]: index for index in inspect(db_engine).get_indexes("documents")}
    full = indexes["ix_documents_application_id"]
    assert full["column_names"] == ["application_id"]
    assert not full["unique"]
    assert not full.get("dialect_options", {}).get("postgresql_where")
    singleton = indexes["uq_documents_application_type"]
    assert singleton["unique"]
    assert singleton["column_names"] == ["application_id", "document_type"]
    assert "reference" in singleton["dialect_options"]["postgresql_where"]
