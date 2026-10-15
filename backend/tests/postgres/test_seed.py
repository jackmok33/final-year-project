import pytest
from sqlalchemy import delete, func, select

from app.models import Application, Document, Programme, ProgrammeMembership, User
from app.seed import seed_demo

pytestmark = pytest.mark.postgres


def counts(session):
    return [
        session.scalar(select(func.count()).select_from(model))
        for model in (User, Programme, ProgrammeMembership, Application, Document)
    ]


def test_seed_is_explicit_and_repeatable_without_overwrites(db_session):
    assert seed_demo(db_session)
    db_session.commit()
    assert counts(db_session) == [4, 2, 4, 0, 0]
    assert not seed_demo(db_session)
    db_session.commit()
    assert counts(db_session) == [4, 2, 4, 0, 0]
    assert db_session.get(User, "tutor-a").is_tutor
    assert db_session.get(User, "admin-a").is_admin
    assert db_session.get(User, "admin-a").memberships == []
    assert not db_session.get(User, "former-tutor").active
    assert all(programme.created_by is None for programme in db_session.scalars(select(Programme)))
    tutor = db_session.get(User, "tutor-a")
    tutor.name = "Edited name"
    tutor.active = False
    db_session.get(Programme, "programme-1").name = "Edited workspace"
    db_session.execute(delete(ProgrammeMembership).where(ProgrammeMembership.user_id == "tutor-b"))
    db_session.commit()
    assert not seed_demo(db_session)
    db_session.commit()
    db_session.expire_all()
    assert counts(db_session) == [4, 2, 3, 0, 0]
    assert tutor.name == "Edited name" and not tutor.active
    assert db_session.get(Programme, "programme-1").name == "Edited workspace"


@pytest.mark.parametrize("has_programme", [False, True])
def test_partially_populated_dataset_is_preserved(db_session, has_programme):
    if has_programme:
        db_session.add(Programme(name="Existing", code="EXISTING", year="2026"))
    else:
        db_session.add(User(name="Existing", email="existing@example.com", is_admin=True))
    db_session.commit()
    before = counts(db_session)
    assert not seed_demo(db_session)
    db_session.commit()
    assert counts(db_session) == before


def test_seed_rolls_back_as_one_transaction(db_session):
    assert seed_demo(db_session)
    db_session.rollback()
    assert counts(db_session) == [0, 0, 0, 0, 0]
    assert seed_demo(db_session)
    db_session.commit()
    assert counts(db_session) == [4, 2, 4, 0, 0]


def test_seed_preserves_existing_application_and_pdf(db_session, saved_document):
    original = saved_document.pdf_bytes
    assert not seed_demo(db_session)
    db_session.commit()
    assert counts(db_session) == [4, 2, 4, 1, 1]
    assert db_session.get(Document, saved_document.id).pdf_bytes == original
