"""attach_audit_triggers_new_tables

Revision ID: 9a58111354de
Revises: 08a0dd986018
Create Date: 2026-06-29 01:14:31.223498

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '9a58111354de'
down_revision: Union[str, Sequence[str], None] = '08a0dd986018'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
        CREATE TRIGGER trg_audit_loco_admin 
        AFTER INSERT OR UPDATE OR DELETE ON public.loco_admin 
        FOR EACH ROW EXECUTE FUNCTION public.process_audit_log('ticket_number');
    """)
    op.execute("""
        CREATE TRIGGER trg_audit_registration_requests 
        AFTER INSERT OR UPDATE OR DELETE ON public.registration_requests 
        FOR EACH ROW EXECUTE FUNCTION public.process_audit_log('request_id');
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP TRIGGER IF EXISTS trg_audit_loco_admin ON public.loco_admin;")
    op.execute("DROP TRIGGER IF EXISTS trg_audit_registration_requests ON public.registration_requests;")
