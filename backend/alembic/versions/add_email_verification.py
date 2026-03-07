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
    # Add is_email_verified column.
    # server_default='1' means ALL existing users are marked as already verified
    # so no one gets locked out. New users created via API will have it set to 0.
    op.add_column(
        "users",
        sa.Column(
            "is_email_verified",
            sa.Boolean(),
            nullable=False,
            server_default="1",   # existing users → verified
        ),
    )


def downgrade():
    op.drop_column("users", "is_email_verified")
