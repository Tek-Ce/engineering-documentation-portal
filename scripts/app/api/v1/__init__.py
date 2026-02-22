# ============================================
# FILE: app/api/v1/__init__.py - CORRECTED VERSION
# ============================================
from fastapi import APIRouter

# Import auth from parent directory since it's in /app/api/
from . import users, projects, documents, comments, tags, notifications, auth, search, project_comments, kb, admin

# Create the main router
router = APIRouter()

# Include sub-routers
router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
router.include_router(users.router, prefix="/users", tags=["Users"])
router.include_router(projects.router, prefix="/projects", tags=["Projects"])
router.include_router(documents.router, prefix="/documents", tags=["Documents"])
router.include_router(comments.router, prefix="/comments", tags=["Comments"])
router.include_router(project_comments.router, prefix="/project-comments", tags=["Project Comments"])
router.include_router(tags.router, prefix="/tags", tags=["Tags"])
router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
router.include_router(search.router, prefix="/search", tags=["Search"])
router.include_router(kb.router, prefix="/kb", tags=["Knowledge Base"])
router.include_router(admin.router, prefix="/admin", tags=["Admin"])

__all__ = ["router"]