# ============================================
# FILE 8: app/crud/notification.py
# ============================================
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.crud.base import CRUDBase
from app.models.notification import Notification
from app.schemas.notification import NotificationCreate, NotificationUpdate
from typing import List, Optional  # ✅ Added Optional
import uuid

class CRUDNotification(CRUDBase[Notification, NotificationCreate, NotificationUpdate]):
    async def get_user_notifications(
        self,
        db: AsyncSession,
        *,
        user_id: str,
        skip: int = 0,
        limit: int = 100,
        unread_only: bool = False
    ) -> tuple[List[Notification], int]:
        """Get user's notifications"""
        query = select(Notification).where(Notification.user_id == user_id)
        
        if unread_only:
            query = query.where(Notification.is_read == False)
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0  # ✅ Ensures int, not None
        
        # Get paginated results
        query = query.offset(skip).limit(limit).order_by(Notification.created_at.desc())
        result = await db.execute(query)
        notifications = result.scalars().all()
        
        return list(notifications), total
    
    async def create(
        self,
        db: AsyncSession,
        *,
        user_id: str,
        message: str,
        type: str,
        project_id: Optional[str] = None,
        document_id: Optional[str] = None
    ) -> Notification:
        """Create notification"""
        db_obj = Notification(
            id=str(uuid.uuid4()),
            user_id=user_id,
            project_id=project_id,
            document_id=document_id,
            type=type,
            message=message
        )
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj
    
    async def mark_as_read(self, db: AsyncSession, *, id: str) -> Optional[Notification]:
        """Mark notification as read"""
        notification = await self.get(db, id=id)
        if notification:
            setattr(notification, "is_read", True)  # ✅ avoids Pylance type error
            await db.flush()
            await db.refresh(notification)
        return notification
    
    async def mark_all_as_read(self, db: AsyncSession, *, user_id: str) -> int:
        """Mark all user notifications as read"""
        result = await db.execute(
            select(Notification).where(
                and_(
                    Notification.user_id == user_id,
                    Notification.is_read == False
                )
            )
        )
        notifications = result.scalars().all()
        
        count = 0
        for notification in notifications:
            setattr(notification, "is_read", True)  # ✅ avoids Pylance error
            count += 1
        
        await db.flush()
        return count
    
    async def get_unread_count(self, db: AsyncSession, *, user_id: str) -> int:
        """Get count of unread notifications"""
        result = await db.execute(
            select(func.count())
            .select_from(Notification)
            .where(
                and_(
                    Notification.user_id == user_id,
                    Notification.is_read == False
                )
            )
        )
        return result.scalar() or 0  # ✅ ensures return type is int, not None

crud_notification = CRUDNotification(Notification)
