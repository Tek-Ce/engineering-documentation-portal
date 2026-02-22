"""add kb fulltext index

Revision ID: kb_fulltext_001
Revises: 
Create Date: 2026-01-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = 'kb_fulltext_001'
down_revision: Union[str, None] ='baseline_001' # Set to latest migration revision
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Add FULLTEXT index support to kb_chunks table.
    
    Changes:
    1. Add chunk_text_fts column for FULLTEXT indexing
    2. Create FULLTEXT index on chunk_text_fts
    3. Add composite indexes for common queries
    """
    
    # Check if column exists first
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('kb_chunks')]
    
    # Add chunk_text_fts column if not exists
    if 'chunk_text_fts' not in columns:
        op.add_column(
            'kb_chunks',
            sa.Column('chunk_text_fts', sa.Text(), nullable=True)
        )
        
        # Copy existing data to new column
        op.execute("""
            UPDATE kb_chunks 
            SET chunk_text_fts = chunk_text 
            WHERE chunk_text_fts IS NULL
        """)
    
    # Create FULLTEXT index (MySQL specific)
    try:
        op.execute("""
            ALTER TABLE kb_chunks 
            ADD FULLTEXT INDEX ft_chunk_text (chunk_text_fts)
        """)
    except Exception as e:
        # Index might already exist
        print(f"Note: FULLTEXT index creation: {e}")
    
    # Add composite index for project+document queries
    try:
        op.create_index(
            'idx_kb_chunks_project_doc',
            'kb_chunks',
            ['project_id', 'document_id'],
            unique=False
        )
    except Exception:
        pass  # Index might already exist
    
    # Add index for chunk ordering
    try:
        op.create_index(
            'idx_kb_chunks_doc_order',
            'kb_chunks',
            ['document_id', 'chunk_index'],
            unique=False
        )
    except Exception:
        pass


def downgrade() -> None:
    """Remove FULLTEXT index and related columns."""
    
    # Drop FULLTEXT index
    try:
        op.execute("ALTER TABLE kb_chunks DROP INDEX ft_chunk_text")
    except Exception:
        pass
    
    # Drop composite indexes
    try:
        op.drop_index('idx_kb_chunks_project_doc', table_name='kb_chunks')
    except Exception:
        pass
    
    try:
        op.drop_index('idx_kb_chunks_doc_order', table_name='kb_chunks')
    except Exception:
        pass
    
    # Drop column
    try:
        op.drop_column('kb_chunks', 'chunk_text_fts')
    except Exception:
        pass
