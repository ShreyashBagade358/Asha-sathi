"""Collapse the six supervisor roles into a single 'admin' role.

The deployment previously distinguished ``anm``, ``moic``, ``bpm``, ``dpm``,
``state_admin`` and ``super_admin``. Those are now one role, ``admin``.
``users.role`` is a plain ``String(32)`` column rather than a database enum, so
this is a data-only migration: no table is rebuilt and no column changes type.

``downgrade`` cannot recover the original role of a demoted account, because
nothing in the row records which tier it used to be. It restores the role
vocabulary but leaves every affected row as ``admin``.

Revision ID: 0006
Revises: 0005
"""

import sqlalchemy as sa

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

LEGACY_ADMIN_ROLES = ("anm", "moic", "bpm", "dpm", "state_admin", "super_admin")


def upgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE users SET role = :new WHERE role IN :legacy"
        ).bindparams(
            new="admin",
            legacy=sa.bindparam("legacy", expanding=True),
        ),
        {"legacy": list(LEGACY_ADMIN_ROLES)},
    )


def downgrade() -> None:
    # Irreversible in the data sense: the pre-merge tier of each account is not
    # recoverable, so demoted rows stay 'admin'. Only the vocabulary is restored.
    op.execute(
        sa.text("UPDATE users SET role = :new WHERE role = :old").bindparams(new="super_admin", old="admin")
    )
