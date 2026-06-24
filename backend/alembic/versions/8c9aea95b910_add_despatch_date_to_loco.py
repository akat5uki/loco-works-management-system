"""add_despatch_date_to_loco

Revision ID: 8c9aea95b910
Revises: 9e8144280b4c
Create Date: 2026-06-25 00:05:00.946754

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8c9aea95b910'
down_revision: Union[str, Sequence[str], None] = '9e8144280b4c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'loco',
        sa.Column('despatch_date', sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('loco', 'despatch_date')
