import pytest
from sqlalchemy import DateTime, String, inspect, text
from sqlalchemy.dialects.postgresql import BYTEA

from alembic import command
from app.db import Base

pytestmark = pytest.mark.postgres
DOMAIN_TABLES = {"users", "programmes", "programme_memberships", "applications", "documents"}


def test_migration_downgrade_upgrade_and_model_consistency(db_engine, migration_config):
    command.downgrade(migration_config, "base")
    assert set(inspect(db_engine).get_table_names()) == {"alembic_version"}
    command.upgrade(migration_config, "head")
    assert set(inspect(db_engine).get_table_names()) == DOMAIN_TABLES | {"alembic_version"}
    command.check(migration_config)
    with db_engine.connect() as connection:
        assert connection.scalar(text("SELECT version_num FROM alembic_version")) == "20261015_0001"


def test_column_types_nullability_and_defaults(db_engine):
    inspector = inspect(db_engine)
    for table in DOMAIN_TABLES:
        columns = {column["name"]: column for column in inspector.get_columns(table)}
        assert set(columns) == set(Base.metadata.tables[table].columns.keys())
        for name, column in columns.items():
            assert column["nullable"] == (table == "programmes" and name == "created_by")
            if name == "id" or name.endswith("_id") or name == "created_by":
                assert isinstance(column["type"], String) and column["type"].length == 200
            if name.endswith("_at"):
                assert isinstance(column["type"], DateTime) and column["type"].timezone
                assert column["default"] == "now()"
    documents = {column["name"]: column for column in inspector.get_columns("documents")}
    assert isinstance(documents["pdf_bytes"]["type"], BYTEA)
    assert documents["sha256"]["type"].length == 64
    assert inspector.get_pk_constraint("programme_memberships")["constrained_columns"] == [
        "user_id",
        "programme_id",
    ]


def test_foreign_key_lookup_indexes_and_delete_rules(db_engine):
    inspector = inspect(db_engine)
    expected_actions = {
        ("programmes", "created_by"): "RESTRICT",
        ("programme_memberships", "user_id"): "CASCADE",
        ("programme_memberships", "programme_id"): "CASCADE",
        ("applications", "programme_id"): "CASCADE",
        ("applications", "created_by"): "RESTRICT",
        ("documents", "application_id"): "CASCADE",
    }
    for table in DOMAIN_TABLES:
        indexes = inspector.get_indexes(table)
        leading_columns = {index["column_names"][0] for index in indexes}
        primary = inspector.get_pk_constraint(table)["constrained_columns"]
        if primary:
            leading_columns.add(primary[0])
        for foreign_key in inspector.get_foreign_keys(table):
            column = foreign_key["constrained_columns"][0]
            assert column in leading_columns
            assert foreign_key["options"]["ondelete"] == expected_actions[(table, column)]
    code_index = next(
        index
        for index in inspector.get_indexes("programmes")
        if index["name"] == "uq_programmes_code_lower"
    )
    assert code_index["unique"]
    assert "lower" in code_index["expressions"][0]
