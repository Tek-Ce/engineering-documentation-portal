"""add_document_type_reviewers_project_comments_approved_status

Revision ID: c9331bd47afe
Revises: 1a2b3c4d5e6f
Create Date: 2025-11-27 18:16:24.485257

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9331bd47afe'
down_revision: Union[str, None] = '1a2b3c4d5e6f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add document_type column to documents table
    op.add_column('documents', sa.Column('document_type', sa.Enum('guide', 'config', 'sop', 'report', 'diagram', 'other', name='documenttype'), nullable=False, server_default='other'))

    # Add 'approved' status to DocumentStatus enum
    op.execute("ALTER TABLE documents MODIFY COLUMN status ENUM('draft', 'review', 'approved', 'published', 'archived') NOT NULL DEFAULT 'draft'")

    # Create document_reviewers association table
    op.create_table(
        'document_reviewers',
        sa.Column('document_id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('assigned_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('document_id', 'user_id')
    )

    # Create project_comments table
    op.create_table(
        'project_comments',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('project_id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=True),
        sa.Column('parent_comment_id', sa.String(36), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('is_resolved', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE', onupdate='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL', onupdate='CASCADE'),
        sa.ForeignKeyConstraint(['parent_comment_id'], ['project_comments.id'], ondelete='CASCADE', onupdate='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create index for project_comments
    op.create_index('ix_project_comments_project_id', 'project_comments', ['project_id'])
    op.create_index('ix_project_comments_parent_comment_id', 'project_comments', ['parent_comment_id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_project_comments_parent_comment_id', table_name='project_comments')
    op.drop_index('ix_project_comments_project_id', table_name='project_comments')

    # Drop project_comments table
    op.drop_table('project_comments')

    # Drop document_reviewers table
    op.drop_table('document_reviewers')

    # Revert DocumentStatus enum (remove 'approved')
    op.execute("ALTER TABLE documents MODIFY COLUMN status ENUM('draft', 'review', 'published', 'archived') NOT NULL DEFAULT 'draft'")

    # Drop document_type column
    op.drop_column('documents', 'document_type')
