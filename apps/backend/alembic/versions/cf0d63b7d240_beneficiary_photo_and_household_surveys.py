"""beneficiary photo and household surveys

Revision ID: cf0d63b7d240
Revises: d017f328a037
Create Date: 2026-10-03 02:15:03.455797

"""
import sqlalchemy as sa

from alembic import op

revision = 'cf0d63b7d240'
down_revision = 'd017f328a037'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Unrelated autogenerate drift (dropped `ix_*_version` indexes, the
    # asha_profiles unique/index reshuffle) was removed from this revision —
    # only the two changes this task introduces are applied.
    op.create_table(
        'household_surveys',
        sa.Column('household_id', sa.String(length=36), nullable=False),
        sa.Column('asha_id', sa.String(length=36), nullable=True),
        sa.Column('answers', sa.JSON(), nullable=False),
        sa.Column('consent_obtained', sa.Boolean(), nullable=False),
        sa.Column('visited_at', sa.Date(), nullable=True),
        sa.Column('created_by', sa.String(length=36), nullable=True),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.ForeignKeyConstraint(['household_id'], ['households.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_household_surveys_household_id'), 'household_surveys', ['household_id'], unique=False)
    op.add_column('beneficiaries', sa.Column('photo_url', sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column('beneficiaries', 'photo_url')
    op.drop_index(op.f('ix_household_surveys_household_id'), table_name='household_surveys')
    op.drop_table('household_surveys')
