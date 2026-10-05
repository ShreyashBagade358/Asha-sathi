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

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Literal SQL on purpose: the role list is fixed by this revision, and a
    # fully static statement keeps it clearly free of injection risk (S608).
    op.execute(
        "UPDATE users SET role = 'admin' "
        "WHERE role IN ('anm', 'moic', 'bpm', 'dpm', 'state_admin', 'super_admin')"
    )


def downgrade() -> None:
    # Irreversible in the data sense: the pre-merge tier of each account is not
    # recoverable, so demoted rows stay 'admin'. Only the vocabulary is restored.
    op.execute("UPDATE users SET role = 'super_admin' WHERE role = 'admin'")
