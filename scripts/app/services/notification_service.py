# ============================================
# FILE: app/services/notification_service.py
# ============================================

"""
Notification Service - Handle user notifications
"""
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select


from app.crud.notification import crud_notification
from app.schemas.notification import NotificationCreate
from app.models.project_member import ProjectMember


class NotificationService:
    """Service for managing notifications"""

    @classmethod
    async def create_notification(
        cls,
        db: AsyncSession,
        user_id: str,
        message: str,
        notification_type: str = "INFO",
        project_id: Optional[str] = None,
        document_id: Optional[str] = None,
        title: Optional[str] = None,
    ):
        """Create a single notification"""
        notif_in = NotificationCreate(
            user_id=user_id,
            message=message,
            type=notification_type,
            project_id=project_id,
            document_id=document_id,
         )
        return await crud_notification.create(
            db=db,
            user_id=notif_in.user_id,
            message=notif_in.message,
            type=notif_in.type,
            project_id=notif_in.project_id,
            document_id=notif_in.document_id,
        )

    @classmethod
    async def notify_user(
        cls,
        db: AsyncSession,
        user_id: str,
        message: str,
        notification_type: str = "INFO",
        project_id: Optional[str] = None,
        document_id: Optional[str] = None,
        title: Optional[str] = None,
    ):
        """Send notification to a single user"""
        return await cls.create_notification(
            db=db,
            user_id=user_id,
            message=message,
            notification_type=notification_type,
            project_id=project_id,
            document_id=document_id,
            title=title,
        )

    @classmethod
    async def notify_multiple_users(
        cls,
        db: AsyncSession,
        user_ids: List[str],
        message: str,
        notification_type: str = "INFO",
        project_id: Optional[str] = None,
        document_id: Optional[str] = None,
        title: Optional[str] = None,
        exclude_user_id: Optional[str] = None,
    ):
        """Send notification to multiple users"""
        for user_id in user_ids:
            if user_id == exclude_user_id:
                continue
            await cls.notify_user(
                db=db,
                user_id=user_id,
                message=message,
                notification_type=notification_type,
                project_id=project_id,
                document_id=document_id,
                title=title,
            )

    @classmethod
    async def notify_project_members(
        cls,
        db: AsyncSession,
        project_id: str,
        message: str,
        notification_type: str = "INFO",
        title: Optional[str] = None,
        document_id: Optional[str] = None,
        exclude_user_id: Optional[str] = None,
    ):
        """Notify all members of a project"""
        # Get all project members
        result = await db.execute(
            select(ProjectMember).where(ProjectMember.project_id == project_id)
        )
        members = result.scalars().all()

        # Filter out excluded user
        user_ids = [
            str(m.user_id) for m in members
            if str(m.user_id) != exclude_user_id
        ]

        # Send notifications
        if user_ids:
            await cls.notify_multiple_users(
                db=db,
                user_ids=user_ids,
                message=message,
                notification_type=notification_type,
                title=title,
                document_id=document_id,
                exclude_user_id=exclude_user_id,
            )
