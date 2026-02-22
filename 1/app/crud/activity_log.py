# ============================================
# CRUD for Activity Logs
# ============================================
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy import select, func, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.activity_log import ActivityLog
from app.models.user import User
from app.models.project import Project


class CRUDActivityLog:
    """CRUD operations for Activity Logs."""

    async def create(
        self,
        db: AsyncSession,
        *,
        user_id: str,
        action: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        project_id: Optional[str] = None,
        description: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> ActivityLog:
        """Create a new activity log entry."""
        log = ActivityLog(
            id=str(uuid.uuid4()),
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            project_id=project_id,
            description=description,
            ip_address=ip_address
        )
        db.add(log)
        await db.flush()
        return log

    async def get_logs(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 50,
        user_id: Optional[str] = None,
        project_id: Optional[str] = None,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """Get activity logs with filters and user/project details."""
        # Build query with joins
        stmt = (
            select(
                ActivityLog,
                User.full_name.label('user_name'),
                User.email.label('user_email'),
                Project.name.label('project_name')
            )
            .outerjoin(User, ActivityLog.user_id == User.id)
            .outerjoin(Project, ActivityLog.project_id == Project.id)
        )

        # Apply filters
        conditions = []
        if user_id:
            conditions.append(ActivityLog.user_id == user_id)
        if project_id:
            conditions.append(ActivityLog.project_id == project_id)
        if action:
            conditions.append(ActivityLog.action == action)
        if resource_type:
            conditions.append(ActivityLog.resource_type == resource_type)
        if date_from:
            conditions.append(ActivityLog.created_at >= date_from)
        if date_to:
            conditions.append(ActivityLog.created_at <= date_to)

        if conditions:
            stmt = stmt.where(and_(*conditions))

        stmt = stmt.order_by(desc(ActivityLog.created_at)).offset(skip).limit(limit)

        result = await db.execute(stmt)
        rows = result.all()

        # Transform to dictionaries
        logs = []
        for row in rows:
            log = row[0]
            logs.append({
                "id": str(log.id),
                "user_id": str(log.user_id) if log.user_id else None,
                "user_name": row.user_name,
                "user_email": row.user_email,
                "project_id": str(log.project_id) if log.project_id else None,
                "project_name": row.project_name,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": str(log.resource_id) if log.resource_id else None,
                "description": log.description,
                "ip_address": log.ip_address,
                "created_at": log.created_at.isoformat() if log.created_at else None
            })

        return logs

    async def count(
        self,
        db: AsyncSession,
        *,
        user_id: Optional[str] = None,
        project_id: Optional[str] = None,
        action: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> int:
        """Count activity logs with filters."""
        stmt = select(func.count(ActivityLog.id))

        conditions = []
        if user_id:
            conditions.append(ActivityLog.user_id == user_id)
        if project_id:
            conditions.append(ActivityLog.project_id == project_id)
        if action:
            conditions.append(ActivityLog.action == action)
        if date_from:
            conditions.append(ActivityLog.created_at >= date_from)
        if date_to:
            conditions.append(ActivityLog.created_at <= date_to)

        if conditions:
            stmt = stmt.where(and_(*conditions))

        result = await db.execute(stmt)
        return result.scalar() or 0

    async def get_action_stats(
        self,
        db: AsyncSession,
        *,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """Get action statistics for the last N days."""
        date_from = datetime.utcnow() - timedelta(days=days)

        stmt = (
            select(
                ActivityLog.action,
                func.count(ActivityLog.id).label('count')
            )
            .where(ActivityLog.created_at >= date_from)
            .group_by(ActivityLog.action)
            .order_by(desc('count'))
        )

        result = await db.execute(stmt)
        rows = result.all()

        return [{"action": row[0], "count": row[1]} for row in rows]

    async def get_user_activity_stats(
        self,
        db: AsyncSession,
        *,
        days: int = 7,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get most active users."""
        date_from = datetime.utcnow() - timedelta(days=days)

        stmt = (
            select(
                ActivityLog.user_id,
                User.full_name,
                User.email,
                func.count(ActivityLog.id).label('activity_count')
            )
            .join(User, ActivityLog.user_id == User.id)
            .where(ActivityLog.created_at >= date_from)
            .group_by(ActivityLog.user_id, User.full_name, User.email)
            .order_by(desc('activity_count'))
            .limit(limit)
        )

        result = await db.execute(stmt)
        rows = result.all()

        return [
            {
                "user_id": str(row[0]),
                "full_name": row[1],
                "email": row[2],
                "activity_count": row[3]
            }
            for row in rows
        ]

    async def get_distinct_actions(self, db: AsyncSession) -> List[str]:
        """Get list of distinct action types."""
        stmt = select(ActivityLog.action).distinct().order_by(ActivityLog.action)
        result = await db.execute(stmt)
        return [row[0] for row in result.all()]

    async def get_distinct_resource_types(self, db: AsyncSession) -> List[str]:
        """Get list of distinct resource types."""
        stmt = (
            select(ActivityLog.resource_type)
            .where(ActivityLog.resource_type.isnot(None))
            .distinct()
            .order_by(ActivityLog.resource_type)
        )
        result = await db.execute(stmt)
        return [row[0] for row in result.all()]


crud_activity_log = CRUDActivityLog()
