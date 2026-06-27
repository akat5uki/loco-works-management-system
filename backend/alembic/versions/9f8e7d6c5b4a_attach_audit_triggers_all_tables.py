"""attach audit triggers to all operational tables

Revision ID: 9f8e7d6c5b4a
Revises: 8c9aea95b910
Create Date: 2026-06-27 14:32:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9f8e7d6c5b4a'
down_revision = '8c9aea95b910'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Attach audit triggers to missing operational tables
    op.execute("""
        CREATE TRIGGER trg_audit_employee_availability 
        AFTER INSERT OR UPDATE OR DELETE ON public.employee_availability 
        FOR EACH ROW EXECUTE FUNCTION public.process_audit_log('availability_id');
    """)
    op.execute("""
        CREATE TRIGGER trg_audit_employee_bookings 
        AFTER INSERT OR UPDATE OR DELETE ON public.employee_bookings 
        FOR EACH ROW EXECUTE FUNCTION public.process_audit_log('booking_id');
    """)
    op.execute("""
        CREATE TRIGGER trg_audit_employee_notifications 
        AFTER INSERT OR UPDATE OR DELETE ON public.employee_notifications 
        FOR EACH ROW EXECUTE FUNCTION public.process_audit_log('notification_id');
    """)
    op.execute("""
        CREATE TRIGGER trg_audit_loco_booking_remarks 
        AFTER INSERT OR UPDATE OR DELETE ON public.loco_booking_remarks 
        FOR EACH ROW EXECUTE FUNCTION public.process_audit_log('remarks_id');
    """)
    op.execute("""
        CREATE TRIGGER trg_audit_tasks 
        AFTER INSERT OR UPDATE OR DELETE ON public.tasks 
        FOR EACH ROW EXECUTE FUNCTION public.process_audit_log('task_id');
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_audit_employee_availability ON public.employee_availability;")
    op.execute("DROP TRIGGER IF EXISTS trg_audit_employee_bookings ON public.employee_bookings;")
    op.execute("DROP TRIGGER IF EXISTS trg_audit_employee_notifications ON public.employee_notifications;")
    op.execute("DROP TRIGGER IF EXISTS trg_audit_loco_booking_remarks ON public.loco_booking_remarks;")
    op.execute("DROP TRIGGER IF EXISTS trg_audit_tasks ON public.tasks;")
