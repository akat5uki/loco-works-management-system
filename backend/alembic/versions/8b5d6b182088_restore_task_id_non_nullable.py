"""restore_task_id_non_nullable

Revision ID: 8b5d6b182088
Revises: 85520895ddf2
Create Date: 2026-06-18 20:29:51.469716

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b5d6b182088'
down_revision: Union[str, Sequence[str], None] = '85520895ddf2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Update NULL values to 1
    op.execute("UPDATE loco_bookings SET task_id = 1 WHERE task_id IS NULL")
    # Make task_id NOT NULL
    op.alter_column('loco_bookings', 'task_id',
               existing_type=sa.BIGINT(),
               nullable=False)
    # Set default to 1
    op.execute("ALTER TABLE loco_bookings ALTER COLUMN task_id SET DEFAULT 1")


def downgrade() -> None:
    op.alter_column('loco_bookings', 'task_id',
               existing_type=sa.BIGINT(),
               nullable=True)
    op.execute("ALTER TABLE loco_bookings ALTER COLUMN task_id DROP DEFAULT")
