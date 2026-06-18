"""cascade_loco_delete

Revision ID: c29ca691d8a5
Revises: b71a2f3fcd11
Create Date: 2026-06-19 03:29:28.602795

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c29ca691d8a5'
down_revision: Union[str, Sequence[str], None] = 'b71a2f3fcd11'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint("fk_loco_bookings_loco_number_loco_loco_number", "loco_bookings", type_="foreignkey", schema="public")
    op.create_foreign_key(
        "fk_loco_bookings_loco_number_loco_loco_number",
        "loco_bookings",
        "loco",
        ["loco_number"],
        ["loco_number"],
        source_schema="public",
        referent_schema="public",
        ondelete="CASCADE"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("fk_loco_bookings_loco_number_loco_loco_number", "loco_bookings", type_="foreignkey", schema="public")
    op.create_foreign_key(
        "fk_loco_bookings_loco_number_loco_loco_number",
        "loco_bookings",
        "loco",
        ["loco_number"],
        ["loco_number"],
        source_schema="public",
        referent_schema="public"
    )
