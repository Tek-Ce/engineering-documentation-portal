# ============================================
# FILE: app/models/__init__.py
# ============================================

from app.db.base_class import Base   # ✅ always import Base first

# Import in dependency-safe order
from app.models.project import Project, ProjectStatus
from app.models.project_member import ProjectMember, ProjectMemberRole
from app.models.user import User, UserRole
from app.models.document import Document, DocumentStatus, DocumentVersion
from app.models.comment import Comment
from app.models.tag import Tag, DocumentTag
from app.models.notification import Notification
from app.models.activity_log import ActivityLog

__all__ = [
    "User", "UserRole",
    "Project", "ProjectStatus",
    "ProjectMember", "ProjectMemberRole",
    "Document", "DocumentStatus", "DocumentVersion",
    "Comment", "Tag", "DocumentTag",
    "Notification", "ActivityLog",
]
