"""make_booking_id_serial

Revision ID: 87b7d18785c8
Revises: 84d3b6852ab3
Create Date: 2026-06-18 20:25:55.676720

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '87b7d18785c8'
down_revision: Union[str, Sequence[str], None] = '84d3b6852ab3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create sequence loco_bookings_booking_id_seq
    op.execute("CREATE SEQUENCE loco_bookings_booking_id_seq")
    # Set default value of booking_id to nextval of sequence
    op.execute("ALTER TABLE loco_bookings ALTER COLUMN booking_id SET DEFAULT nextval('loco_bookings_booking_id_seq')")
    # Set sequence value to MAX(booking_id)+1 or 1 if empty
    op.execute("SELECT setval('loco_bookings_booking_id_seq', COALESCE((SELECT MAX(booking_id) FROM loco_bookings), 0) + 1, false)")


def downgrade() -> None:
    # Remove default value
    op.execute("ALTER TABLE loco_bookings ALTER COLUMN booking_id DROP DEFAULT")
    # Drop sequence
    op.execute("DROP SEQUENCE loco_bookings_booking_id_seq")
