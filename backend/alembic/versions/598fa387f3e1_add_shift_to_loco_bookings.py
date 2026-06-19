"""add_shift_to_loco_bookings

Revision ID: 598fa387f3e1
Revises: 8dcfb4bbf5e9
Create Date: 2026-06-18 23:43:04.465528

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '598fa387f3e1'
down_revision: Union[str, Sequence[str], None] = '8dcfb4bbf5e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add shift column to loco_bookings.
    Existing rows get shift = 1 as a safe default.
    """
    op.add_column(
        'loco_bookings',
        sa.Column('shift', sa.Integer(), nullable=False, server_default='1'),
    )
    op.alter_column('loco_bookings', 'shift', server_default=None)


def downgrade() -> None:
    op.drop_column('loco_bookings', 'shift')
