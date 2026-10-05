"""Add household demographic columns collected by the registration form.

Revision ID: 0007
Revises: 0006

head_name, ward, family_size, contact_phone and notes were collected by
addHousehold but had nowhere to land, so the form could only toast success.
All columns are nullable so existing rows and the offline sync path are
unaffected.
"""

import sqlalchemy as sa

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

_COLUMNS = [
    sa.Column("head_name", sa.String(200), nullable=True),
    sa.Column("ward", sa.String(100), nullable=True),
    sa.Column("family_size", sa.Integer(), nullable=True),
    sa.Column("contact_phone", sa.String(15), nullable=True),
    sa.Column("notes", sa.String(500), nullable=True),
]


def upgrade() -> None:
    bind = op.get_bind()
    existing = {c["name"] for c in sa.inspect(bind).get_columns("households")}
    for column in _COLUMNS:
        if column.name not in existing:
            op.add_column("households", column)


def downgrade() -> None:
    bind = op.get_bind()
    existing = {c["name"] for c in sa.inspect(bind).get_columns("households")}
    for column in _COLUMNS:
        if column.name in existing:
            op.drop_column("households", column.name)
