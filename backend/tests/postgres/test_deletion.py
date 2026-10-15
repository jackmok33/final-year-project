import pytest
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError

from app.models import Application, Document, Programme, ProgrammeMembership, User
from app.seed import seed_demo

pytestmark = pytest.mark.postgres


@pytest.mark.parametrize("use_orm", [False, True])
def test_programme_delete_cascades_only_its_children(db_session, saved_document, use_orm):
    programme = db_session.get(Programme, "programme-1")
    # Load children too: ORM must not attempt to null non-nullable foreign keys.
    assert len(programme.memberships) == 3
    assert programme.applications[0].documents[0].id == saved_document.id
    if use_orm:
        db_session.delete(programme)
    else:
        db_session.execute(delete(Programme).where(Programme.id == programme.id))
    db_session.commit()
    db_session.expunge_all()
    assert db_session.scalar(select(func.count()).select_from(Document)) == 0
    assert db_session.scalar(select(func.count()).select_from(Application)) == 0
    assert db_session.scalar(select(func.count()).select_from(ProgrammeMembership)) == 1
    assert db_session.get(Programme, "programme-2") is not None
    assert db_session.scalar(select(func.count()).select_from(User)) == 4


def test_application_delete_cascades_pdfs_but_preserves_course(db_session, saved_document):
    application = db_session.get(Application, saved_document.application_id)
    assert application.documents
    db_session.delete(application)
    db_session.commit()
    db_session.expunge_all()
    assert db_session.get(Document, saved_document.id) is None
    assert db_session.get(Programme, "programme-1") is not None


def test_unreferenced_user_delete_removes_membership_only(db_session):
    seed_demo(db_session)
    user = db_session.get(User, "former-tutor")
    assert len(user.memberships) == 1
    db_session.delete(user)
    db_session.commit()
    assert db_session.scalar(select(func.count()).select_from(ProgrammeMembership)) == 3
    assert db_session.scalar(select(func.count()).select_from(Programme)) == 2


@pytest.mark.parametrize("reference", ["creator", "submitter"])
def test_user_delete_is_restricted_to_preserve_attribution(db_session, reference):
    seed_demo(db_session)
    if reference == "creator":
        db_session.get(Programme, "programme-1").created_by = "tutor-a"
    else:
        db_session.add(
            Application(programme_id="programme-1", candidate_reference="A", created_by="tutor-a")
        )
    db_session.commit()
    user = db_session.get(User, "tutor-a")
    assert user.created_programmes if reference == "creator" else user.submitted_applications
    assert user.memberships
    db_session.delete(user)
    with pytest.raises(IntegrityError) as error:
        db_session.commit()
    expected = (
        "fk_programmes_created_by_users"
        if reference == "creator"
        else "fk_applications_created_by_users"
    )
    assert error.value.orig.diag.constraint_name == expected
    db_session.rollback()
    assert db_session.get(User, "tutor-a") is not None


def test_deactivation_and_membership_removal_preserve_application(db_session, saved_document):
    db_session.get(User, "tutor-a").active = False
    db_session.execute(delete(ProgrammeMembership).where(ProgrammeMembership.user_id == "tutor-a"))
    db_session.commit()
    assert db_session.get(Application, saved_document.application_id) is not None
    assert db_session.get(Document, saved_document.id) is not None
    assert not db_session.get(User, "tutor-a").active
