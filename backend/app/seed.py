"""Explicit, transactional demo bootstrap. Never overwrite an existing domain dataset."""

from sqlalchemy import exists, select, text
from sqlalchemy.orm import Session

from app.db import create_db_engine, session_factory
from app.models import Application, Document, Programme, ProgrammeMembership, User


def seed_demo(session: Session) -> bool:
    """Return True if seeded. Caller owns the transaction and commit/rollback.

    Lock all domain tables during the empty check and inserts so a concurrent seed
    or writer cannot slip between them. No schema creation or browser import occurs.
    """
    session.execute(
        text(
            "LOCK TABLE users, programmes, programme_memberships, applications, documents "
            "IN SHARE ROW EXCLUSIVE MODE"
        )
    )
    if any(
        session.scalar(select(exists().select_from(model)))
        for model in (User, Programme, ProgrammeMembership, Application, Document)
    ):
        return False

    session.add_all(
        [
            User(
                id="tutor-a",
                name="Jack · Demo tutor",
                email="tutor@demo.ucl.local",
                is_tutor=True,
            ),
            User(
                id="tutor-b",
                name="Demo tutor B",
                email="tutor.b@demo.ucl.local",
                is_tutor=True,
            ),
            User(
                id="admin-a",
                name="Demo administrator",
                email="admin@demo.ucl.local",
                is_admin=True,
            ),
            User(
                id="former-tutor",
                name="Former tutor",
                email="former@demo.ucl.local",
                is_tutor=True,
                active=False,
            ),
            Programme(
                id="programme-1",
                name="Programme · TBC",
                code="PG-TBC",
                year="2026 / 27",
                department="To be confirmed",
                description="Postgraduate admissions workspace for the selected programme.",
            ),
            Programme(
                id="programme-2",
                name="Data Science · Example",
                code="PG-DS-DEMO",
                year="2026 / 27",
                department="Example department",
                description="Synthetic second course workspace. Not UCL admissions policy.",
            ),
        ]
    )
    session.flush()
    session.add_all(
        ProgrammeMembership(user_id=user_id, programme_id=programme_id)
        for user_id, programme_id in (
            ("tutor-a", "programme-1"),
            ("tutor-a", "programme-2"),
            ("tutor-b", "programme-1"),
            ("former-tutor", "programme-1"),
        )
    )
    session.flush()
    return True


def main() -> None:
    engine = create_db_engine()
    try:
        with session_factory(engine).begin() as session:
            created = seed_demo(session)
        print(
            "Created 4 demo accounts, 2 example programmes and 4 memberships. "
            "Applications and documents are empty."
            if created
            else "Existing domain data preserved; no changes made."
        )
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
