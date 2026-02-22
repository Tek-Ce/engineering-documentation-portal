# ============================================
# FILE 7: app/models/document.py
# ============================================
from sqlalchemy import Column, String, Text, Integer, BIGINT, DateTime, Enum as SQLEnum, ForeignKey, UniqueConstraint, Table
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base_class import Base
import enum

# Association table for document reviewers
document_reviewers = Table(
    'document_reviewers',
    Base.metadata,
    Column('document_id', String(36), ForeignKey('documents.id', ondelete='CASCADE'), primary_key=True),
    Column('user_id', String(36), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    Column('assigned_at', DateTime, server_default=func.now(), nullable=False)
)

class DocumentStatus(str, enum.Enum):
    DRAFT = "draft"
    REVIEW = "review"
    APPROVED = "approved"
    PUBLISHED = "published"
    ARCHIVED = "archived"

class DocumentType(str, enum.Enum):
    GUIDE = "guide"
    CONFIG = "config"
    SOP = "sop"
    REPORT = "report"
    DIAGRAM = "diagram"
    OTHER = "other"

class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True)
    project_id = Column(String(36), ForeignKey('projects.id', ondelete='CASCADE', onupdate='CASCADE'), nullable=False)
    uploaded_by = Column(String(36), ForeignKey('users.id', ondelete='SET NULL', onupdate='CASCADE'))
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_size = Column(BIGINT, nullable=True)
    file_type = Column(String(50), nullable=True)
    mime_type = Column(String(100), nullable=True)
    document_type = Column(String(50), default=DocumentType.OTHER.value, nullable=False)
    status = Column(String(50), default=DocumentStatus.DRAFT.value, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    uploaded_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    project = relationship("Project", back_populates="documents")
    uploader = relationship("User", back_populates="documents_uploaded", foreign_keys=[uploaded_by])
    versions = relationship("DocumentVersion", back_populates="document", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="document", cascade="all, delete-orphan")
    tags = relationship("DocumentTag", back_populates="document", cascade="all, delete-orphan")
    reviewers = relationship("User", secondary=document_reviewers, backref="documents_to_review")

class DocumentVersion(Base):
    __tablename__ = "document_versions"
    
    id = Column(String(36), primary_key=True)
    document_id = Column(String(36), ForeignKey('documents.id', ondelete='CASCADE', onupdate='CASCADE'), nullable=False)
    version_number = Column(Integer, nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(BIGINT, nullable=True)
    uploaded_by = Column(String(36), ForeignKey('users.id', ondelete='SET NULL', onupdate='CASCADE'))
    change_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    
    __table_args__ = (
        UniqueConstraint('document_id', 'version_number', name='uq_doc_version'),
    )
    
    # Relationships
    document = relationship("Document", back_populates="versions")
   