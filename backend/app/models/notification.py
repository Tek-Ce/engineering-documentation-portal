# ============================================
# FILE 10: app/models/notification.py
# ============================================
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base_class import Base 


class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE', onupdate='CASCADE'), nullable=False)
    project_id = Column(String(36), ForeignKey('projects.id', ondelete='CASCADE', onupdate='CASCADE'))
    document_id = Column(String(36), ForeignKey('documents.id', ondelete='CASCADE', onupdate='CASCADE'))
    type = Column(String(50), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="notifications", foreign_keys=[user_id])
    project = relationship("Project", back_populates="notifications")
