"""add loco_admin and registration_requests tables

Revision ID: b1e2f3a4c5d6
Revises: 5bab562f2510
Create Date: 2026-06-28 21:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'b1e2f3a4c5d6'
down_revision: Union[str, Sequence[str], None] = 'a3fd9f729cb9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create loco_admin table
    op.create_table(
        'loco_admin',
        sa.Column('ticket_number', sa.Integer(), nullable=False),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('must_change_password', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['ticket_number'], ['employees.ticket_number'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('ticket_number')
    )

    # 2. Create registration_requests table
    op.create_table(
        'registration_requests',
        sa.Column('request_id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('reg_code', sa.String(length=12), nullable=False),
        sa.Column('ticket_number', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('designation_id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('password_hash', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='PENDING'),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('valid_until', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['designation_id'], ['designation.designation_id']),
        sa.PrimaryKeyConstraint('request_id')
    )
    op.create_index(op.f('ix_registration_requests_reg_code'), 'registration_requests', ['reg_code'], unique=True)
    op.create_index(op.f('ix_registration_requests_ticket_number'), 'registration_requests', ['ticket_number'], unique=False)
    op.create_index(op.f('ix_registration_requests_status'), 'registration_requests', ['status'], unique=False)
    op.create_index(op.f('ix_registration_requests_valid_until'), 'registration_requests', ['valid_until'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_registration_requests_valid_until'), table_name='registration_requests')
    op.drop_index(op.f('ix_registration_requests_status'), table_name='registration_requests')
    op.drop_index(op.f('ix_registration_requests_ticket_number'), table_name='registration_requests')
    op.drop_index(op.f('ix_registration_requests_reg_code'), table_name='registration_requests')
    op.drop_table('registration_requests')
    op.drop_table('loco_admin')
