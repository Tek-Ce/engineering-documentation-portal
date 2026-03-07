"""Add notification preference columns to users table

Revision ID: user_004
Revises: kb_002
Create Date: 2026-03-07

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'user_004'
down_revision: Union[str, None] = 'kb_002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'users' not in inspector.get_table_names():
        return
    cols = [c['name'] for c in inspector.get_columns('users')]

    if 'notify_login_alert' not in cols:
        op.add_column('users', sa.Column('notify_login_alert', sa.Boolean(), nullable=False, server_default='0'))

    if 'notify_security_events' not in cols:
        op.add_column('users', sa.Column('notify_security_events', sa.Boolean(), nullable=False, server_default='1'))

    if 'notify_document_activity' not in cols:
        op.add_column('users', sa.Column('notify_document_activity', sa.Boolean(), nullable=False, server_default='1'))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'users' not in inspector.get_table_names():
        return
    cols = [c['name'] for c in inspector.get_columns('users')]

    for col in ('notify_document_activity', 'notify_security_events', 'notify_login_alert'):
        if col in cols:
            op.drop_column('users', col)
