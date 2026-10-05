"""One task per household, per day, per type.

Revision ID: 0008
Revises: cf0d63b7d240

The daily plan generator hands each ASHA up to five visits a day; this unique
index makes a duplicate assignment impossible even when two requests race.
Rows with a NULL household_id or task_date are exempt (SQLite treats NULLs as
distinct), so one-off beneficiary-only tasks keep working.
"""

import sqlalchemy as sa

from alembic import op

revision = "0008"
down_revision = "cf0d63b7d240"
branch_labels = None
depends_on = None

_INDEX = "uq_asha_tasks_day_household_type"
_COLUMNS = ["asha_id", "task_date", "household_id", "task_type"]

_DEDUPE = sa.text(
    """
    DELETE FROM asha_tasks
    WHERE household_id IS NOT NULL
      AND task_date IS NOT NULL
      AND id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY asha_id, task_date, household_id, task_type
            ORDER BY updated_at DESC, id DESC
          ) AS rn
          FROM asha_tasks
          WHERE household_id IS NOT NULL
            AND task_date IS NOT NULL
        ) ranked
        WHERE ranked.rn = 1
      )
    """
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("asha_tasks"):
        return
    if _INDEX in {index["name"] for index in inspector.get_indexes("asha_tasks")}:
        return
    bind.execute(_DEDUPE)
    op.create_index(_INDEX, "asha_tasks", _COLUMNS, unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("asha_tasks") and _INDEX in {
        index["name"] for index in inspector.get_indexes("asha_tasks")
    }:
        op.drop_index(_INDEX, table_name="asha_tasks")
