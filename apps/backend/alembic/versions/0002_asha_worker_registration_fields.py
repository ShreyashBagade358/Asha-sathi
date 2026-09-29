"""Add worker registration fields to asha_profiles

date_of_birth, gender, emergency contact and date_of_joining are collected
by the PHC admin registration form but were not persisted anywhere.

NOTE: 0001 creates asha_profiles from Base.metadata using the *current* model
metadata, which already contains all of these columns, so each add_column here
is guarded to keep the chain idempotent against a freshly-created schema.

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-25
"""

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

_COLUMNS = (
    ("date_of_birth", sa.Date()),
    ("gender", sa.String(16)),
    ("emergency_contact_name", sa.String(200)),
    ("emergency_contact_phone", sa.String(15)),
    ("date_of_joining", sa.Date()),
)


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    existing = {c["name"] for c in inspector.get_columns("asha_profiles")}
    for name, column in _COLUMNS:
        if name not in existing:
            op.add_column("asha_profiles", sa.Column(name, column, nullable=True))


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    existing = {c["name"] for c in inspector.get_columns("asha_profiles")}
    for name, _column in reversed(_COLUMNS):
        if name in existing:
            op.drop_column("asha_profiles", name)
