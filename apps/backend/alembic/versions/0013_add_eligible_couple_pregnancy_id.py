"""Add pregnancy_id to eligible_couples.

Revision ID: 0013
Revises: 0012

The model gained ``pregnancy_id`` (FK -> pregnancies.id) after the table was
created via ``Base.metadata.create_all`` on Neon; create_all never ALTERs
existing tables, so the column was missing and every SELECT against
``eligible_couples`` 500'd on production.
"""

import sqlalchemy as sa

from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "eligible_couples",
        sa.Column("pregnancy_id", sa.String(36), nullable=True),
    )
    op.create_index(
        op.f("ix_eligible_couples_pregnancy_id"),
        "eligible_couples",
        ["pregnancy_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_eligible_couples_pregnancy_id",
        "eligible_couples",
        "pregnancies",
        ["pregnancy_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_eligible_couples_pregnancy_id", "eligible_couples", type_="foreignkey"
    )
    op.drop_index(op.f("ix_eligible_couples_pregnancy_id"), table_name="eligible_couples")
    op.drop_column("eligible_couples", "pregnancy_id")
