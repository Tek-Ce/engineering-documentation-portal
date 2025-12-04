# ============================================
# FILE 9: app/models/tag.py
# ============================================
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base_class import Base 

class Tag(Base):
    __tablename__ = "tags"
    
    id = Column(String(36), primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    color = Column(String(7), default='#3B82F6')
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    
    # Relationships
    document_tags = relationship("DocumentTag", back_populates="tag", cascade="all, delete-orphan")

class DocumentTag(Base):
    __tablename__ = "document_tags"
    
    document_id = Column(String(36), ForeignKey('documents.id', ondelete='CASCADE', onupdate='CASCADE'), primary_key=True)
    tag_id = Column(String(36), ForeignKey('tags.id', ondelete='CASCADE', onupdate='CASCADE'), primary_key=True)
    tagged_by = Column(String(36), ForeignKey('users.id', ondelete='SET NULL', onupdate='CASCADE'))
    tagged_at = Column(DateTime, server_default=func.now(), nullable=False)
    
    # Relationships
    document = relationship("Document", back_populates="tags")
    tag = relationship("Tag", back_populates="document_tags")