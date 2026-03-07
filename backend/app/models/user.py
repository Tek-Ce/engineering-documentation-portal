# =====================
# app/models.user.py
#======================

from sqlalchemy import Column, String, Boolean, DateTime, Enum as SQLEnum, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base_class import Base
import enum
import uuid


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    ENGINEER = "ENGINEER"
    VIEWER = "VIEWER"


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    full_name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.VIEWER, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_email_verified = Column(Boolean, default=False, nullable=False)
    last_login = Column(DateTime, nullable=True)
    last_activity = Column(DateTime, nullable=True)  # Track user's last activity for online status
    notify_login_alert = Column(Boolean, default=False, nullable=False)      # Email on new login
    notify_security_events = Column(Boolean, default=True, nullable=False)   # Email on password change / account changes
    notify_document_activity = Column(Boolean, default=True, nullable=False) # Email on document approvals/reviews
    created_by = Column(String(36), ForeignKey('users.id', ondelete='SET NULL', onupdate='CASCADE'))
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    # ✅ Relationships
    projects_created = relationship("Project", back_populates="creator", foreign_keys="Project.created_by")
    project_memberships = relationship("ProjectMember", back_populates="user", foreign_keys="[ProjectMember.user_id]", overlaps="added_by_user")
    documents_uploaded = relationship("Document", back_populates="uploader", foreign_keys="Document.uploaded_by")
    comments = relationship("Comment", back_populates="user", foreign_keys="Comment.user_id")
    notifications = relationship("Notification", back_populates="user", foreign_keys="Notification.user_id")
