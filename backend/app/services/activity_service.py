# ============================================
# FILE: app/services/activity_service.py
# ============================================
"""
Activity Service - Log user activities (persisted to activity_logs table)
"""
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.activity_log import crud_activity_log


class ActivityService:
    """Service for logging user activities"""

    @classmethod
    async def log_activity(
        cls,
        db: AsyncSession,
        user_id: Optional[str],
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        description: Optional[str] = None,
        project_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ):
        """
        Log an activity to the database.

        Actions: DOCUMENT_UPLOADED, DOCUMENT_UPDATED, DOCUMENT_DELETED,
                 DOCUMENT_SUBMITTED_REVIEW, DOCUMENT_APPROVED, DOCUMENT_REJECTED,
                 PROJECT_CREATED, COMMENT_ADDED, etc.
        """
        log = await crud_activity_log.create(
            db,
            user_id=user_id or "",
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            description=description,
            project_id=project_id,
            ip_address=ip_address,
        )
        return log
    
    @classmethod
    async def get_user_activities(
        cls,
        db: AsyncSession,
        user_id: str,
        limit: int = 50
    ):
        """Get recent activities for a user"""
        # TODO: Implement if you have activity_logs table
        return []
    
    @classmethod
    async def get_project_activities(
        cls,
        db: AsyncSession,
        project_id: str,
        limit: int = 50
    ):
        """Get recent activities for a project"""
        # TODO: Implement if you have activity_logs table
        return []