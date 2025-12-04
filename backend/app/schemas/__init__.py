# ============================================
# FILE: app/schemas/__init__.py
# ============================================
from app.schemas.user import (
    UserBase, UserCreate, UserUpdate, UserResponse, UserListResponse
)
from app.schemas.auth import (
    LoginRequest, TokenResponse, PasswordChange
)
from app.schemas.project import (
    ProjectBase, ProjectCreate, ProjectUpdate, ProjectResponse,
    ProjectDetailResponse
)
from app.schemas.project_member import (
    ProjectMemberBase, ProjectMemberCreate, ProjectMemberUpdate,
    ProjectMemberResponse, ProjectMemberWithUser, ProjectMemberWithProject
)
from app.schemas.document import (
    DocumentBase, DocumentCreate, DocumentUpdate, DocumentResponse,
    DocumentVersionResponse, DocumentListResponse
)
from app.schemas.comment import (
    CommentBase, CommentCreate, CommentUpdate, CommentResponse
)
from app.schemas.tag import (
    TagBase, TagCreate, TagUpdate, TagResponse
)
from app.schemas.notification import (
    NotificationBase, NotificationCreate, NotificationUpdate,
    NotificationResponse
)

__all__ = [
    # User
    "UserBase", "UserCreate", "UserUpdate", "UserResponse", "UserListResponse",
    # Auth
    "LoginRequest", "TokenResponse", "PasswordChange",
    # Project
    "ProjectBase", "ProjectCreate", "ProjectUpdate", "ProjectResponse", "ProjectDetailResponse",
    # Project Members
    "ProjectMemberBase", "ProjectMemberCreate", "ProjectMemberUpdate",
    "ProjectMemberResponse", "ProjectMemberWithUser", "ProjectMemberWithProject",
    # Document
    "DocumentBase", "DocumentCreate", "DocumentUpdate", "DocumentResponse",
    "DocumentVersionResponse", "DocumentListResponse",
    # Comment
    "CommentBase", "CommentCreate", "CommentUpdate", "CommentResponse",
    # Tag
    "TagBase", "TagCreate", "TagUpdate", "TagResponse",
    # Notification
    "NotificationBase", "NotificationCreate", "NotificationUpdate",
    "NotificationResponse",
]
