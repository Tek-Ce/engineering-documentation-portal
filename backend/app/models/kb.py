"""
Knowledge Base Models
Matches MySQL database schema created via SQL
"""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer, Boolean, Numeric, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base_class import Base


class KBChunk(Base):
    """Stores document chunks with embeddings"""
    __tablename__ = "kb_chunks"

    id = Column(String(36), primary_key=True)
    project_id = Column(String(36), ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    document_id = Column(String(36), ForeignKey('documents.id', ondelete='CASCADE'), nullable=True)

    # Source tracking
    source_type = Column(String(50), nullable=False)
    source_id = Column(String(36), nullable=False)

    # Content
    chunk_text = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    token_count = Column(Integer, nullable=True)

    # Embedding (stored as JSON for MySQL)
    embedding = Column(JSON, nullable=False)

    # Metadata (using 'meta' as Python attribute name to avoid SQLAlchemy reserved word)
    meta = Column('metadata', JSON, nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    indexed_at = Column(DateTime, server_default=func.now())

    # Relationships
    project = relationship('Project', back_populates='kb_chunks')
    document = relationship('Document')


class KBSummary(Base):
    """Cache for generated summaries"""
    __tablename__ = 'kb_summaries'

    id = Column(String(36), primary_key=True)
    project_id = Column(String(36), ForeignKey('projects.id', ondelete='CASCADE'), nullable=True)
    document_id = Column(String(36), ForeignKey('documents.id', ondelete='CASCADE'), nullable=True)

    # Summary content
    summary_type = Column(String(50), nullable=False)
    summary_text = Column(Text, nullable=False)
    key_points = Column(JSON, nullable=True)

    # Generation tracking
    generated_by = Column(String(50), nullable=True)
    generation_cost = Column(Numeric(10, 4), nullable=True)
    token_count = Column(Integer, nullable=True)

    # Validity
    valid_until = Column(DateTime, nullable=True)
    content_hash = Column(String(64), nullable=True)

    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    project = relationship('Project', back_populates='kb_summaries')
    document = relationship('Document')


class KBProcessingJob(Base):
    """Tracks document indexing jobs"""
    __tablename__ = 'kb_processing_jobs'

    id = Column(String(36), primary_key=True)
    document_id = Column(String(36), ForeignKey('documents.id', ondelete='CASCADE'), nullable=False)
    project_id = Column(String(36), ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)

    # Job status
    status = Column(String(50), nullable=False, server_default='queued')
    job_type = Column(String(50), nullable=False)

    # Progress tracking
    progress = Column(Integer, server_default='0')
    total_chunks = Column(Integer, nullable=True)
    processed_chunks = Column(Integer, server_default='0')

    # Results
    error_message = Column(Text, nullable=True)
    result = Column(JSON, nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    document = relationship('Document')
    project = relationship('Project')


class KBSettings(Base):
    """KB settings per project"""
    __tablename__ = 'kb_settings'

    id = Column(String(36), primary_key=True)
    project_id = Column(String(36), ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)

    # Privacy settings
    allow_cloud_llm = Column(Boolean, server_default='0')
    allow_web_search = Column(Boolean, server_default='0')

    # Data retention
    embedding_retention_days = Column(Integer, server_default='365')
    summary_cache_days = Column(Integer, server_default='30')

    # LLM preferences
    preferred_llm = Column(String(50), server_default='local')
    max_llm_cost_per_month = Column(Numeric(10, 2), server_default='100.0')

    # Access control
    who_can_chat = Column(String(50), server_default='project_members')

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    project = relationship('Project')


class KBAuditLog(Base):
    """Audit log for KB operations"""
    __tablename__ = 'kb_audit_log'

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    project_id = Column(String(36), ForeignKey('projects.id', ondelete='CASCADE'), nullable=True)

    # Action details
    action = Column(String(50), nullable=False)
    llm_provider = Column(String(50), nullable=True)

    # Token usage
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    cost = Column(Numeric(10, 4), nullable=True)

    # Request details
    query = Column(Text, nullable=True)
    response_time_ms = Column(Integer, nullable=True)

    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    user = relationship('User')
    project = relationship('Project')


class KBExternalSource(Base):
    """Cache for external search results"""
    __tablename__ = 'kb_external_sources'

    id = Column(String(36), primary_key=True)
    project_id = Column(String(36), ForeignKey('projects.id', ondelete='CASCADE'), nullable=True)

    # Query and result
    query_text = Column(Text, nullable=False)
    url = Column(Text, nullable=False)
    title = Column(Text, nullable=True)
    snippet = Column(Text, nullable=True)
    domain = Column(String(255), nullable=True)
    credibility_score = Column(Integer, nullable=True)

    # Cache control
    fetched_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime, nullable=True)

    # Relationships
    project = relationship('Project')
