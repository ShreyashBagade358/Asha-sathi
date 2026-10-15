"""Fix composite-PK bug on malaria_cases / tb_cases.

Revision ID: 0012
Revises: 0011

Both tables declared ``disease_case_id`` as ``primary_key=True`` while also
inheriting BaseModel's ``id`` primary key, producing a composite PK that
broke ``db.get(MalariaCase, ...)`` semantics and confused upserts. They are
one-to-one detail rows for a ``disease_cases`` record, so:

* the PK is only ``id`` (BaseModel);
* ``disease_case_id`` becomes a unique foreign key to ``disease_cases.id``.

The rebuild is a copy-through so existing rows survive; the composite PK
guarantees one row per disease case already, so dedupe is not needed.
"""

import sqlalchemy as sa

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None

_DETAIL_COLUMNS = [
    ("species", sa.String(40)),
    ("parasite_count", sa.Float),
    ("rdt_result", sa.String(20)),
    ("microscopy_result", sa.String(40)),
    ("severe_malaria", sa.Boolean),
    ("severe_signs", sa.JSON),
    ("injectable_artesunate_given", sa.Boolean),
    ("referral_for_severe", sa.Boolean),
]

_TB_COLUMNS = [
    ("tb_type", sa.String(40)),
    ("site_extrapulmonary", sa.String(40)),
    ("bacteriologically_confirmed", sa.Boolean),
    ("cbnaat_result", sa.String(40)),
    ("drug_resistance_test", sa.String(40)),
    ("dr_tb_type", sa.String(40)),
    ("hiv_status", sa.String(20)),
    ("diabetes_status", sa.String(20)),
    ("treatment_category", sa.String(30)),
    ("regimen", sa.String(120)),
    ("nikshay_id", sa.String(64)),
    ("nikshay_registered", sa.Boolean),
]


def _rebuild(inspector: sa.Inspector, bind, table: str, columns) -> None:
    if not inspector.has_table(table):
        return

    old_pk = set(inspector.get_pk_constraint(table)["constrained_columns"] or [])
    if old_pk == {"id"}:
        return  # already fixed

    tmp = f"{table}_rebuild"
    meta = sa.MetaData()
    sa.Table(
        tmp,
        meta,
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("disease_case_id", sa.String(36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("version", sa.Integer, server_default="1"),
        *[sa.Column(name, col_type, nullable=True) for name, col_type in columns],
    )
    meta.create_all(bind)

    src_cols = ["id", "disease_case_id", "created_at", "updated_at", "version"] + [n for n, _ in columns]
    # Table/column names are internal constants above, never user input.
    bind.execute(
        sa.text(
            f"INSERT INTO {tmp} ({', '.join(src_cols)}) SELECT {', '.join(src_cols)} FROM {table}"  # noqa: S608
        )
    )
    bind.execute(sa.text(f"DROP TABLE {table}"))
    bind.execute(sa.text(f"ALTER TABLE {tmp} RENAME TO {table}"))
    # Postgres keeps the temp table's PK constraint name after the rename.
    bind.execute(
        sa.text(f"ALTER TABLE {table} RENAME CONSTRAINT {tmp}_pkey TO {table}_pkey")
    )
    # FK added after rename — the temp MetaData cannot resolve disease_cases.
    bind.execute(
        sa.text(
            f"ALTER TABLE {table} ADD CONSTRAINT fk_{table}_disease_case "
            f"FOREIGN KEY (disease_case_id) REFERENCES disease_cases (id)"
        )
    )
    bind.execute(sa.text(f"CREATE UNIQUE INDEX ix_{table}_disease_case_id ON {table} (disease_case_id)"))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    _rebuild(inspector, bind, "malaria_cases", _DETAIL_COLUMNS)
    _rebuild(inspector, bind, "tb_cases", _TB_COLUMNS)


def downgrade() -> None:
    raise NotImplementedError("Composite-PK fix is not reversible; restore from backup if needed.")
