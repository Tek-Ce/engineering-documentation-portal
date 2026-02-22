# ============================================
# FILE: app/models/project.py
# ============================================
from sqlalchemy import Column, String, ForeignKey, Enum as SQLEnum, DateTime, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base_class import Base
import enum


class ProjectStatus(str, enum.Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    COMPLETED = "completed"


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True)
    name = Column(String(150), nullable=False, unique=True)
    code = Column(String(20), unique=True, nullable=False)
    description = Column(String(1000), nullable=True)
    brief = Column(String(500), nullable=True)
    status = Column(String(20), default="active")
    is_active = Column(Boolean, default=True)
    created_by = Column(String(36), ForeignKey("users.id"))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships (referenced by string to avoid circular import)
    members = relationship("ProjectMember", back_populates="project")
    documents = relationship("Document", back_populates="project")
    notifications = relationship("Notification", back_populates="project")
    project_comments = relationship("ProjectComment", back_populates="project", cascade="all, delete-orphan")
    creator = relationship("User", back_populates="projects_created", foreign_keys="Project.created_by")
    kb_chunks = relationship("KBChunk", back_populates="project", cascade="all, delete-orphan")
    kb_summaries = relationship("KBSummary", back_populates="project", cascade="all, delete-orphan")


class ProjectRole(str, enum.Enum):
    OWNER = "OWNER"
    EDITOR = "EDITOR"
    VIEWER = "VIEWER"



