# ============================================
# FILE 8: app/models/comment.py
# ============================================
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class Comment(Base):
    __tablename__ = "comments"

    id = Column(String(36), primary_key=True)
    document_id = Column(String(36), ForeignKey('documents.id', ondelete='CASCADE', onupdate='CASCADE'), nullable=False)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='SET NULL', onupdate='CASCADE'))
    parent_comment_id = Column(String(36), ForeignKey('comments.id', ondelete='CASCADE', onupdate='CASCADE'))
    content = Column(Text, nullable=False)
    is_resolved = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    document = relationship("Document", back_populates="comments")
    user = relationship("User", back_populates="comments", foreign_keys=[user_id])
    replies = relationship("Comment", backref="parent", remote_side=[id])


class ProjectComment(Base):
    __tablename__ = "project_comments"

    id = Column(String(36), primary_key=True)
    project_id = Column(String(36), ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='SET NULL'))
    parent_comment_id = Column(String(36), ForeignKey('project_comments.id', ondelete='CASCADE'), nullable=True)
    content = Column(Text, nullable=False)
    is_resolved = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    project = relationship("Project", back_populates="project_comments")
    user = relationship("User", foreign_keys=[user_id])

    # Self-referential
    parent = relationship(
        "ProjectComment",
        remote_side=[id],
        back_populates="replies",
        lazy="joined"
    )
    replies = relationship(
        "ProjectComment",
        back_populates="parent",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
