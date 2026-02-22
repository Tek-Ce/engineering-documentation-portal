"""add source_id, source_type, and token_count columns to kb_chunks

Revision ID: kb_002
Revises: kb_fulltext_001
Create Date: 2026-01-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'kb_002'
down_revision: Union[str, None] = 'user_003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Add missing columns to kb_chunks table:
    - source_id: tracks the source entity ID (document_id, comment_id, etc.)
    - source_type: type of source (document, comment, etc.)
    - token_count: number of tokens in the chunk
    """
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('kb_chunks')]

    # Add source_id column if not exists
    if 'source_id' not in columns:
        op.add_column(
            'kb_chunks',
            sa.Column('source_id', sa.String(36), nullable=True)
        )

        # Populate source_id from document_id for existing records
        op.execute("""
            UPDATE kb_chunks
            SET source_id = document_id
            WHERE source_id IS NULL AND document_id IS NOT NULL
        """)

        # Make it NOT NULL after populating
        op.alter_column(
            'kb_chunks',
            'source_id',
            existing_type=sa.String(36),
            nullable=False
        )

    # Add source_type column if not exists
    if 'source_type' not in columns:
        op.add_column(
            'kb_chunks',
            sa.Column('source_type', sa.String(50), nullable=True, server_default='document')
        )

        # Set default for existing records
        op.execute("""
            UPDATE kb_chunks
            SET source_type = 'document'
            WHERE source_type IS NULL
        """)

        # Make it NOT NULL after populating
        op.alter_column(
            'kb_chunks',
            'source_type',
            existing_type=sa.String(50),
            nullable=False,
            server_default=None
        )

    # Add token_count column if not exists
    if 'token_count' not in columns:
        op.add_column(
            'kb_chunks',
            sa.Column('token_count', sa.Integer(), nullable=True)
        )

    # Add indexed_at column if not exists
    if 'indexed_at' not in columns:
        op.add_column(
            'kb_chunks',
            sa.Column('indexed_at', sa.DateTime(), server_default=sa.func.now())
        )

    # Add chunk_index column if not exists
    if 'chunk_index' not in columns:
        op.add_column(
            'kb_chunks',
            sa.Column('chunk_index', sa.Integer(), nullable=False, server_default='0')
        )


def downgrade() -> None:
    """Remove source_id, source_type, token_count, indexed_at, and chunk_index columns."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('kb_chunks')]

    if 'chunk_index' in columns:
        op.drop_column('kb_chunks', 'chunk_index')

    if 'indexed_at' in columns:
        op.drop_column('kb_chunks', 'indexed_at')

    if 'token_count' in columns:
        op.drop_column('kb_chunks', 'token_count')

    if 'source_id' in columns:
        op.drop_column('kb_chunks', 'source_id')

    if 'source_type' in columns:
        op.drop_column('kb_chunks', 'source_type')
