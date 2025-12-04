"""Add description and is_active to projects table

Revision ID: 0b756220eba0
Revises: 
Create Date: 2025-11-26 23:14:53.467489

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0b756220eba0'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_active column to projects table
    # Note: description column already exists in the database, so we only add is_active
    op.add_column('projects', sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'))


def downgrade() -> None:
    # Remove is_active column from projects table
    op.drop_column('projects', 'is_active')
