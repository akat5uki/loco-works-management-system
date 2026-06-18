"""implement_booking_tasks_relationship

Revision ID: b71a2f3fcd11
Revises: 8b5d6b182088
Create Date: 2026-06-18 21:26:59.626421

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b71a2f3fcd11'
down_revision: Union[str, Sequence[str], None] = '8b5d6b182088'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Drop the foreign key on loco_bookings pointing to tasks
    op.drop_constraint("fk_loco_bookings_task_id_tasks_task_id", "loco_bookings", type_="foreignkey")
    
    # 2. Drop task_id column from loco_bookings
    op.drop_column("loco_bookings", "task_id")
    
    # 3. Drop tasks table and its trigger
    op.execute("DROP TRIGGER IF EXISTS trg_audit_tasks ON public.tasks;")
    op.execute("DROP TABLE IF EXISTS public.tasks CASCADE;")
    
    # 4. Create booking_tasks table
    op.create_table(
        "booking_tasks",
        sa.Column("task_id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("loco_number", sa.Integer(), nullable=False),
        sa.Column("date_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("task_description", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["loco_number", "date_time", "job_id"],
            ["public.loco_bookings.loco_number", "public.loco_bookings.date_time", "public.loco_bookings.job_id"],
            name="fk_booking_tasks_loco_bookings",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("task_id"),
        schema="public",
    )
    
    # 5. Create audit trigger for booking_tasks
    op.execute("""
    CREATE TRIGGER trg_audit_booking_tasks
    AFTER INSERT OR UPDATE OR DELETE ON public.booking_tasks
    FOR EACH ROW EXECUTE FUNCTION public.process_audit_log('task_id');
    """)


def downgrade() -> None:
    """Downgrade schema."""
    # 1. Drop trigger on booking_tasks
    op.execute("DROP TRIGGER IF EXISTS trg_audit_booking_tasks ON public.booking_tasks;")
    
    # 2. Drop booking_tasks table
    op.drop_table("booking_tasks", schema="public")
    
    # 3. Create tasks table
    op.create_table(
        "tasks",
        sa.Column("task_id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("task_description", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("task_id"),
        schema="public",
    )
    
    # 4. Create trigger on tasks table
    op.execute("""
    CREATE TRIGGER trg_audit_tasks
    AFTER INSERT OR UPDATE OR DELETE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.process_audit_log('task_id');
    """)
    
    # 5. Re-add task_id column to loco_bookings with default 1
    op.add_column("loco_bookings", sa.Column("task_id", sa.BigInteger(), nullable=False, server_default="1"))
    
    # 6. Re-create foreign key on loco_bookings pointing to tasks
    op.create_foreign_key("fk_loco_bookings_task_id_tasks_task_id", "loco_bookings", "tasks", ["task_id"], ["task_id"], source_schema="public", referent_schema="public")
