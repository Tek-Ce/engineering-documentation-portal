"""merge_email_verification_with_main

Revision ID: 5019df4c90bc
Revises: a9f3e1b7c2d4, user_004
Create Date: 2026-03-08 19:33:21.791853

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5019df4c90bc'
down_revision: Union[str, None] = ('a9f3e1b7c2d4', 'user_004')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
