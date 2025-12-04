"""add file_name to document_versions and versioning fields to comments

Revision ID: 1a2b3c4d5e6f
Revises: 0b756220eba0
Create Date: 2025-11-27 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '1a2b3c4d5e6f'
down_revision = '0b756220eba0'
branch_labels = None
depends_on = None


def upgrade():
    # Add file_name to document_versions (nullable)
    op.add_column('document_versions', sa.Column('file_name', sa.String(length=255), nullable=True))

    # Add document_version_id and anchor to comments
    op.add_column('comments', sa.Column('document_version_id', sa.String(length=36), nullable=True))
    op.add_column('comments', sa.Column('anchor', sa.Text(), nullable=True))

    # Add foreign key constraint for document_version_id
    op.create_foreign_key(
        'fk_comments_document_version',
        'comments', 'document_versions',
        ['document_version_id'], ['id'],
        ondelete='CASCADE', onupdate='CASCADE'
    )


def downgrade():
    # Drop foreign key then columns
    op.drop_constraint('fk_comments_document_version', 'comments', type_='foreignkey')
    op.drop_column('comments', 'anchor')
    op.drop_column('comments', 'document_version_id')

    op.drop_column('document_versions', 'file_name')
