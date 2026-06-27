"""sync loco_bookings foreign key cascade constraint

Revision ID: 5bab562f2510
Revises: 9f8e7d6c5b4a
Create Date: 2026-06-27 09:08:07.462309

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '5bab562f2510'
down_revision: Union[str, Sequence[str], None] = '9f8e7d6c5b4a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.drop_constraint(op.f('fk_loco_bookings_loco_number_loco_loco_number'), 'loco_bookings', type_='foreignkey')
    op.create_foreign_key(
        op.f('fk_loco_bookings_loco_number_loco_loco_number'), 
        'loco_bookings', 
        'loco', 
        ['loco_number'], 
        ['loco_number'], 
        ondelete='CASCADE'
    )

def downgrade() -> None:
    op.drop_constraint(op.f('fk_loco_bookings_loco_number_loco_loco_number'), 'loco_bookings', type_='foreignkey')
    op.create_foreign_key(
        op.f('fk_loco_bookings_loco_number_loco_loco_number'), 
        'loco_bookings', 
        'loco', 
        ['loco_number'], 
        ['loco_number']
    )
