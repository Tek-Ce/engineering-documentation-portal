"""Add knowledge base tables (MySQL compatible)

Revision ID: a1b2c3d4e5f6
Revises: 92385eb160b5
Create Date: 2025-12-03

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers
revision = 'a1b2c3d4e5f6'
down_revision = 'c9331bd47afe'  # Point to the last working migration
branch_labels = None
depends_on = None


def upgrade():
    # KB Chunks table - stores document chunks with embeddings (as JSON)
    op.create_table(
        'kb_chunks',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('document_id', sa.String(36), sa.ForeignKey('documents.id', ondelete='CASCADE'), nullable=True),

        # Source tracking
        sa.Column('source_type', sa.String(50), nullable=False),
        sa.Column('source_id', sa.String(36), nullable=False),

        # Content
        sa.Column('chunk_text', sa.Text, nullable=False),
        sa.Column('chunk_index', sa.Integer, nullable=False),
        sa.Column('token_count', sa.Integer),

        # Vector embedding stored as JSON (MySQL doesn't support vector type)
        sa.Column('embedding', sa.JSON, nullable=False),

        # Metadata
        sa.Column('metadata', sa.JSON, server_default='{}'),

        # Timestamps
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()')),
        sa.Column('indexed_at', sa.DateTime, server_default=sa.text('NOW()')),

        mysql_engine='InnoDB',
        mysql_charset='utf8mb4'
    )

    # Indexes for fast queries
    op.create_index('idx_kb_chunks_project', 'kb_chunks', ['project_id'])
    op.create_index('idx_kb_chunks_document', 'kb_chunks', ['document_id'])
    op.create_index('idx_kb_chunks_source', 'kb_chunks', ['source_type', 'source_id'])

    # Full-text search index
    op.create_index('idx_kb_chunks_text', 'kb_chunks', ['chunk_text'], mysql_length=255)

    # KB Summaries table - cache for generated summaries
    op.create_table(
        'kb_summaries',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE')),
        sa.Column('document_id', sa.String(36), sa.ForeignKey('documents.id', ondelete='CASCADE')),

        # Summary content
        sa.Column('summary_type', sa.String(50), nullable=False),
        sa.Column('summary_text', sa.Text, nullable=False),
        sa.Column('key_points', sa.JSON),

        # Generation tracking
        sa.Column('generated_by', sa.String(50)),
        sa.Column('generation_cost', sa.Numeric(10, 4)),
        sa.Column('token_count', sa.Integer),

        # Validity
        sa.Column('valid_until', sa.DateTime),
        sa.Column('content_hash', sa.String(64)),

        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()')),

        mysql_engine='InnoDB',
        mysql_charset='utf8mb4'
    )

    # Unique constraint
    op.create_index('unique_doc_summary', 'kb_summaries', ['document_id', 'summary_type'], unique=True)
    op.create_index('idx_kb_summaries_project', 'kb_summaries', ['project_id'])

    # External sources cache
    op.create_table(
        'kb_external_sources',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE')),

        # Query and result
        sa.Column('query_text', sa.Text, nullable=False),
        sa.Column('url', sa.Text, nullable=False),
        sa.Column('title', sa.Text),
        sa.Column('snippet', sa.Text),
        sa.Column('domain', sa.String(255)),
        sa.Column('credibility_score', sa.Integer),

        # Cache control
        sa.Column('fetched_at', sa.DateTime, server_default=sa.text('NOW()')),
        sa.Column('expires_at', sa.DateTime),

        mysql_engine='InnoDB',
        mysql_charset='utf8mb4'
    )

    # Processing jobs table
    op.create_table(
        'kb_processing_jobs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('document_id', sa.String(36), sa.ForeignKey('documents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),

        # Job status
        sa.Column('status', sa.String(50), nullable=False, server_default='queued'),
        sa.Column('job_type', sa.String(50), nullable=False),

        # Progress tracking
        sa.Column('progress', sa.Integer, server_default='0'),
        sa.Column('total_chunks', sa.Integer),
        sa.Column('processed_chunks', sa.Integer, server_default='0'),

        # Results
        sa.Column('error_message', sa.Text),
        sa.Column('result', sa.JSON),

        # Timestamps
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()')),
        sa.Column('started_at', sa.DateTime),
        sa.Column('completed_at', sa.DateTime),

        mysql_engine='InnoDB',
        mysql_charset='utf8mb4'
    )

    op.create_index('idx_kb_jobs_status', 'kb_processing_jobs', ['status'])
    op.create_index('idx_kb_jobs_document', 'kb_processing_jobs', ['document_id'])

    # KB Settings table
    op.create_table(
        'kb_settings',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),

        # Privacy settings
        sa.Column('allow_cloud_llm', sa.Boolean, server_default='0'),
        sa.Column('allow_web_search', sa.Boolean, server_default='0'),

        # Data retention
        sa.Column('embedding_retention_days', sa.Integer, server_default='365'),
        sa.Column('summary_cache_days', sa.Integer, server_default='30'),

        # LLM preferences
        sa.Column('preferred_llm', sa.String(50), server_default='local'),
        sa.Column('max_llm_cost_per_month', sa.Numeric(10, 2), server_default='100.0'),

        # Access control
        sa.Column('who_can_chat', sa.String(50), server_default='project_members'),

        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('NOW()')),

        mysql_engine='InnoDB',
        mysql_charset='utf8mb4'
    )

    op.create_index('idx_kb_settings_project', 'kb_settings', ['project_id'], unique=True)

    # Audit log
    op.create_table(
        'kb_audit_log',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL')),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE')),

        # Action details
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('llm_provider', sa.String(50)),

        # Token usage
        sa.Column('input_tokens', sa.Integer),
        sa.Column('output_tokens', sa.Integer),
        sa.Column('cost', sa.Numeric(10, 4)),

        # Request details
        sa.Column('query', sa.Text),
        sa.Column('response_time_ms', sa.Integer),

        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()')),

        mysql_engine='InnoDB',
        mysql_charset='utf8mb4'
    )

    op.create_index('idx_kb_audit_user', 'kb_audit_log', ['user_id'])
    op.create_index('idx_kb_audit_project', 'kb_audit_log', ['project_id'])
    op.create_index('idx_kb_audit_created', 'kb_audit_log', ['created_at'])


def downgrade():
    op.drop_table('kb_audit_log')
    op.drop_table('kb_settings')
    op.drop_table('kb_processing_jobs')
    op.drop_table('kb_external_sources')
    op.drop_table('kb_summaries')
    op.drop_table('kb_chunks')
