"""baseline_existing_schema

Revision ID: fe769040cc2f
Revises: 
Create Date: 2026-01-28 17:36:59.025720

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "baseline_001"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Baseline migration — schema already exists
    pass

def downgrade():
    pass
