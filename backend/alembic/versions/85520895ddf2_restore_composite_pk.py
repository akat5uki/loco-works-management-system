"""restore_composite_pk

Revision ID: 85520895ddf2
Revises: 87b7d18785c8
Create Date: 2026-06-18 20:28:51.139785

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '85520895ddf2'
down_revision: Union[str, Sequence[str], None] = '87b7d18785c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop existing PK constraint
    op.drop_constraint('loco_bookings_pkey', 'loco_bookings', type_='primary')
    # Drop booking_id column
    op.drop_column('loco_bookings', 'booking_id')
    # Drop sequence loco_bookings_booking_id_seq
    op.execute("DROP SEQUENCE IF EXISTS loco_bookings_booking_id_seq")
    # Restore composite primary key constraint
    op.create_primary_key('loco_bookings_pkey', 'loco_bookings', ['loco_number', 'date_time', 'job_id'])
    # Recreate the audit trigger for loco_bookings to use composite keys
    op.execute("DROP TRIGGER IF EXISTS trg_audit_loco_bookings ON public.loco_bookings")
    op.execute("CREATE TRIGGER trg_audit_loco_bookings AFTER INSERT OR UPDATE OR DELETE ON public.loco_bookings FOR EACH ROW EXECUTE FUNCTION public.process_audit_log('loco_number', 'date_time', 'job_id')")


def downgrade() -> None:
    # Drop audit trigger
    op.execute("DROP TRIGGER IF EXISTS trg_audit_loco_bookings ON public.loco_bookings")
    # Create audit trigger with booking_id
    op.execute("CREATE TRIGGER trg_audit_loco_bookings AFTER INSERT OR UPDATE OR DELETE ON public.loco_bookings FOR EACH ROW EXECUTE FUNCTION public.process_audit_log('booking_id')")
    # Drop composite PK constraint
    op.drop_constraint('loco_bookings_pkey', 'loco_bookings', type_='primary')
    # Create sequence
    op.execute("CREATE SEQUENCE loco_bookings_booking_id_seq")
    # Add booking_id column with default value
    op.add_column('loco_bookings', sa.Column('booking_id', sa.Integer(), autoincrement=True, nullable=False))
    op.execute("ALTER TABLE loco_bookings ALTER COLUMN booking_id SET DEFAULT nextval('loco_bookings_booking_id_seq')")
    # Create PK on booking_id
    op.create_primary_key('loco_bookings_pkey', 'loco_bookings', ['booking_id'])
