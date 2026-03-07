"""add email verification to users

Revision ID: a9f3e1b7c2d4
Revises: fe769040cc2f
Create Date: 2026-03-06 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "a9f3e1b7c2d4"
down_revision = "baseline_001"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'users' not in inspector.get_table_names():
        return
    cols = [c['name'] for c in inspector.get_columns('users')]
    if 'is_email_verified' not in cols:
        op.add_column(
            "users",
            sa.Column(
                "is_email_verified",
                sa.Boolean(),
                nullable=False,
                server_default="1",
            ),
        )


def downgrade():
    op.drop_column("users", "is_email_verified")
