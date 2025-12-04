"""
Admin-only endpoints for system management
"""
from typing import Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select

from app.api.deps import get_current_admin_user
from app.db.database import get_db
from app.models.user import User
from app.models.project import Project
from app.models.document import Document
from app.models.comment import Comment
from app.models.notification import Notification
from app.models.tag import Tag
from app.models.activity_log import ActivityLog
from app.models.project_member import ProjectMember
from app.models.kb import (
    KBChunk,
    KBSummary,
    KBProcessingJob,
    KBSettings,
    KBAuditLog,
    KBExternalSource
)

router = APIRouter()


@router.post("/reset-database", response_model=Dict[str, str])
async def reset_database(
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Clear all data from the system except the default admin user.
    This is a destructive operation and cannot be undone.

    Requires: ADMIN role
    """
    try:
        # Define the default admin email
        DEFAULT_ADMIN_EMAIL = "admin@engportal.local"

        # Get the default admin user to preserve
        result = await db.execute(
            select(User).where(User.email == DEFAULT_ADMIN_EMAIL)
        )
        default_admin = result.scalar_one_or_none()

        if not default_admin:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Default admin user ({DEFAULT_ADMIN_EMAIL}) not found in system"
            )

        # Delete in order respecting foreign key constraints
        # Start with dependent tables first

        # 1. Delete activity logs
        await db.execute(delete(ActivityLog))

        # 2. Delete KB audit logs
        await db.execute(delete(KBAuditLog))

        # 3. Delete KB external sources
        await db.execute(delete(KBExternalSource))

        # 4. Delete KB processing jobs
        await db.execute(delete(KBProcessingJob))

        # 5. Delete KB summaries
        await db.execute(delete(KBSummary))

        # 6. Delete KB chunks
        await db.execute(delete(KBChunk))

        # 7. Delete KB settings
        await db.execute(delete(KBSettings))

        # 8. Delete comments (they reference documents and users)
        await db.execute(delete(Comment))

        # 9. Delete notifications (they reference users)
        await db.execute(delete(Notification))

        # 10. Delete documents (they reference projects)
        await db.execute(delete(Document))

        # 11. Delete project members (they reference projects and users)
        await db.execute(delete(ProjectMember))

        # 12. Delete projects
        await db.execute(delete(Project))

        # 13. Delete tags
        await db.execute(delete(Tag))

        # 14. Delete all users EXCEPT the default admin
        await db.execute(
            delete(User).where(User.id != str(default_admin.id))
        )

        # Commit all deletions
        await db.commit()

        return {
            "status": "success",
            "message": f"All data cleared successfully. Default admin user ({DEFAULT_ADMIN_EMAIL}) preserved."
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset database: {str(e)}"
        )
