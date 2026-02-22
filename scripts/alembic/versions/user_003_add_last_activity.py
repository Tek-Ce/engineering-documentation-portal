"""Add last_activity column to users table

Revision ID: user_003
Revises: kb_fulltext_001
Create Date: 2026-01-30

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'user_003'
down_revision: Union[str, None] = 'kb_fulltext_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add last_activity column to users table
    op.add_column('users', sa.Column('last_activity', sa.DateTime(), nullable=True))


def downgrade() -> None:
    # Remove last_activity column
    op.drop_column('users', 'last_activity')
