"""Child family links: mother_id (required at API) + father_id (optional),
plus delivery_outcome_id linking a child to the mother's recorded delivery.

Revision ID: 0011
Revises: 0010

Children previously carried no parent reference at all — maternity was only
implied by household membership. Adding explicit mother_id / father_id
columns lets every child page resolve parents directly. Both link columns
stay nullable at the DB layer (the offline sync path pushes rows before
parents may exist); ``POST /children`` enforces that mother_id is present.
``delivery_outcome_id`` joins a child to the DeliveryOutcome recorded at
birth when one exists.
"""

import sqlalchemy as sa

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def _has_column(inspector: sa.Inspector, table: str, column: str) -> bool:
    if not inspector.has_table(table):
        return True
    return column in {c["name"] for c in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("children"):
        return

    if not _has_column(inspector, "children", "mother_id"):
        op.add_column("children", sa.Column("mother_id", sa.String(36), nullable=True))
        op.create_index("ix_children_mother_id", "children", ["mother_id"], unique=False)

    if not _has_column(inspector, "children", "father_id"):
        op.add_column("children", sa.Column("father_id", sa.String(36), nullable=True))
        op.create_index("ix_children_father_id", "children", ["father_id"], unique=False)

    if not _has_column(inspector, "children", "delivery_outcome_id"):
        op.add_column("children", sa.Column("delivery_outcome_id", sa.String(36), nullable=True))
        op.create_index("ix_children_delivery_outcome_id", "children", ["delivery_outcome_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("children"):
        return
    indexes = {i["name"] for i in inspector.get_indexes("children")}
    for col, idx in (
        ("mother_id", "ix_children_mother_id"),
        ("father_id", "ix_children_father_id"),
        ("delivery_outcome_id", "ix_children_delivery_outcome_id"),
    ):
        if idx in indexes:
            op.drop_index(idx, table_name="children")
        if _has_column(inspector, "children", col):
            op.drop_column("children", col)
