"""add_despatched_to_loco

Revision ID: 9e8144280b4c
Revises: 598fa387f3e1
Create Date: 2026-06-19 17:30:37.076911

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '9e8144280b4c'
down_revision: Union[str, Sequence[str], None] = '598fa387f3e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add despatched column to loco table.
    # server_default=false() backfills existing rows as not despatched.
    op.add_column(
        'loco',
        sa.Column('despatched', sa.Boolean(), nullable=False, server_default=sa.false())
    )
    # Remove server default after backfill — app-level default takes over.
    op.alter_column('loco', 'despatched', server_default=None)


def downgrade() -> None:
    op.drop_column('loco', 'despatched')
