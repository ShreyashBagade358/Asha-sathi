"""Family linking: relationship_to_head, users.beneficiary_id, household backfill.

Revision ID: 0009
Revises: 0008

Three related gaps this closes:

1. ``POST /patients/register`` only ever stored ``household_id`` inside the
   beneficiary's metadata JSON, so API-registered patients never appeared in
   ``GET /households/{id}/members`` or in their ASHA's sync scope. Backfill
   the column from metadata (resolving both UUID and hhid references).
2. ``users.beneficiary_id`` gives the login account a durable link to its
   own beneficiary row; backfill it from the historical phone join.
3. ``beneficiaries.relationship_to_head`` records how each member relates to
   the household head (previously only a free-text ``head_name`` existed).

All steps are idempotent and dialect-neutral so SQLite (tests) and Postgres
(prod) both work.
"""

import json

import sqlalchemy as sa

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def _has_column(inspector: sa.Inspector, table: str, column: str) -> bool:
    if not inspector.has_table(table):
        return True
    return column in {c["name"] for c in inspector.get_columns(table)}


def _load_json(value):
    if value is None or isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except ValueError:
            return None
    return None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # 1. relationship_to_head ------------------------------------------------
    if not _has_column(inspector, "beneficiaries", "relationship_to_head"):
        op.add_column("beneficiaries", sa.Column("relationship_to_head", sa.String(30), nullable=True))

    # 2. users.beneficiary_id ------------------------------------------------
    users_index = "ix_users_beneficiary_id" if inspector.has_table("users") else None
    if users_index and not _has_column(inspector, "users", "beneficiary_id"):
        op.add_column("users", sa.Column("beneficiary_id", sa.String(36), nullable=True))
    if users_index:
        existing = {i["name"] for i in inspector.get_indexes("users")}
        if "ix_users_beneficiary_id" not in existing and "uq_users_beneficiary_id" not in existing:
            op.create_index("ix_users_beneficiary_id", "users", ["beneficiary_id"], unique=True)

    # 3. Backfill beneficiaries.household_id from metadata -------------------
    if inspector.has_table("beneficiaries") and inspector.has_table("households"):
        households = sa.table("households", sa.column("id"), sa.column("hhid"), sa.column("asha_id"))
        refs: dict[str, str] = {}
        for hid, hhid in bind.execute(sa.select(households.c.id, households.c.hhid)):
            refs[str(hid)] = str(hid)
            if hhid:
                refs.setdefault(str(hhid), str(hid))

        beneficiaries = sa.table(
            "beneficiaries",
            sa.column("id"),
            sa.column("household_id"),
            sa.column("metadata"),
        )
        rows = bind.execute(
            sa.select(beneficiaries.c.id, beneficiaries.c.metadata).where(beneficiaries.c.household_id.is_(None))
        ).fetchall()
        for row_id, metadata in rows:
            meta = _load_json(metadata) or {}
            ref = meta.get("household_id")
            resolved = refs.get(str(ref)) if ref else None
            if resolved:
                bind.execute(sa.update(beneficiaries).where(beneficiaries.c.id == row_id).values(household_id=resolved))

    # 4. Backfill users.beneficiary_id from the phone join -------------------
    if inspector.has_table("users") and inspector.has_table("beneficiaries"):
        users = sa.table("users", sa.column("id"), sa.column("phone"), sa.column("role"), sa.column("beneficiary_id"))
        beneficiaries = sa.table(
            "beneficiaries",
            sa.column("id"),
            sa.column("phone"),
            sa.column("status"),
            sa.column("created_at"),
        )
        pending = bind.execute(
            sa.select(users.c.id, users.c.phone).where(users.c.beneficiary_id.is_(None), users.c.phone.is_not(None))
        ).fetchall()
        for user_id, phone in pending:
            match = bind.execute(
                sa.select(beneficiaries.c.id)
                .where(beneficiaries.c.phone == phone, beneficiaries.c.status == "active")
                .order_by(beneficiaries.c.created_at)
                .limit(1)
            ).scalar_one_or_none()
            if match:
                bind.execute(sa.update(users).where(users.c.id == user_id).values(beneficiary_id=match))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("users"):
        indexes = {i["name"] for i in inspector.get_indexes("users")}
        if "ix_users_beneficiary_id" in indexes:
            op.drop_index("ix_users_beneficiary_id", table_name="users")
        if _has_column(inspector, "users", "beneficiary_id"):
            op.drop_column("users", "beneficiary_id")
    if inspector.has_table("beneficiaries") and _has_column(inspector, "beneficiaries", "relationship_to_head"):
        op.drop_column("beneficiaries", "relationship_to_head")
