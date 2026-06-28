"""add nonce and employee_portal_enabled to loco_admin

Revision ID: 43c45606d0c9
Revises: 9a58111354de
Create Date: 2026-06-29 01:59:32.000000

"""
from typing import Sequence, Union

import secrets
import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = '43c45606d0c9'
down_revision: Union[str, Sequence[str], None] = '9a58111354de'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add nonce and employee_portal_enabled columns to loco_admin."""
    # Add nonce column — generate a unique nonce for each existing row
    op.add_column('loco_admin', sa.Column('nonce', sa.String(), nullable=True))

    # Backfill existing rows with unique nonces
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT ticket_number FROM loco_admin")).fetchall()
    for row in rows:
        conn.execute(
            sa.text("UPDATE loco_admin SET nonce = :nonce WHERE ticket_number = :ticket"),
            {"nonce": secrets.token_hex(16), "ticket": row[0]}
        )

    # Now make it NOT NULL
    op.alter_column('loco_admin', 'nonce', nullable=False)

    # Add employee_portal_enabled column
    # Default False for new rows; existing rows: False (admins re-setup via new workflow)
    op.add_column(
        'loco_admin',
        sa.Column('employee_portal_enabled', sa.Boolean(), nullable=False, server_default=sa.text('FALSE'))
    )


def downgrade() -> None:
    """Remove nonce and employee_portal_enabled columns from loco_admin."""
    op.drop_column('loco_admin', 'employee_portal_enabled')
    op.drop_column('loco_admin', 'nonce')
