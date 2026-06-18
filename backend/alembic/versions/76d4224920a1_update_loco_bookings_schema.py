"""update_loco_bookings_schema

Revision ID: 76d4224920a1
Revises: 7e349de4489d
Create Date: 2026-06-18 19:51:33.284611

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '76d4224920a1'
down_revision: Union[str, Sequence[str], None] = '7e349de4489d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop existing PK constraint
    op.drop_constraint('loco_bookings_pkey', 'loco_bookings', type_='primary')
    # Add booking_id column
    op.add_column('loco_bookings', sa.Column('booking_id', sa.Integer(), autoincrement=True, nullable=False))
    # Create new primary key constraint on booking_id
    op.create_primary_key('loco_bookings_pkey', 'loco_bookings', ['booking_id'])
    # Make task_id nullable
    op.alter_column('loco_bookings', 'task_id',
               existing_type=sa.BIGINT(),
               nullable=True)
    # Recreate the audit trigger for loco_bookings to use booking_id
    op.execute("DROP TRIGGER IF EXISTS trg_audit_loco_bookings ON public.loco_bookings")
    op.execute("CREATE TRIGGER trg_audit_loco_bookings AFTER INSERT OR UPDATE OR DELETE ON public.loco_bookings FOR EACH ROW EXECUTE FUNCTION public.process_audit_log('booking_id')")


def downgrade() -> None:
    # Drop the trigger
    op.execute("DROP TRIGGER IF EXISTS trg_audit_loco_bookings ON public.loco_bookings")
    # Recreate old trigger
    op.execute("CREATE TRIGGER trg_audit_loco_bookings AFTER INSERT OR UPDATE OR DELETE ON public.loco_bookings FOR EACH ROW EXECUTE FUNCTION public.process_audit_log('loco_number', 'date_time', 'job_id')")
    # Drop new PK constraint
    op.drop_constraint('loco_bookings_pkey', 'loco_bookings', type_='primary')
    # Drop column booking_id
    op.drop_column('loco_bookings', 'booking_id')
    # Make task_id non-nullable
    op.alter_column('loco_bookings', 'task_id',
               existing_type=sa.BIGINT(),
               nullable=False)
    # Recreate old PK constraint
    op.create_primary_key('loco_bookings_pkey', 'loco_bookings', ['loco_number', 'date_time', 'job_id'])
