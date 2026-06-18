"""make_tasks_serial

Revision ID: 84d3b6852ab3
Revises: 76d4224920a1
Create Date: 2026-06-18 19:52:19.283570

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '84d3b6852ab3'
down_revision: Union[str, Sequence[str], None] = '76d4224920a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create sequence tasks_task_id_seq
    op.execute("CREATE SEQUENCE tasks_task_id_seq")
    # Set default value of task_id to nextval of sequence
    op.execute("ALTER TABLE tasks ALTER COLUMN task_id SET DEFAULT nextval('tasks_task_id_seq')")
    # Set sequence value to MAX(task_id)+1 or 1 if empty
    op.execute("SELECT setval('tasks_task_id_seq', COALESCE((SELECT MAX(task_id) FROM tasks), 0) + 1, false)")


def downgrade() -> None:
    # Remove default value
    op.execute("ALTER TABLE tasks ALTER COLUMN task_id DROP DEFAULT")
    # Drop sequence
    op.execute("DROP SEQUENCE tasks_task_id_seq")
