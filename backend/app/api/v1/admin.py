"""
Admin-only endpoints for system management
"""
from typing import Dict, List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select
from pydantic import BaseModel

from app.api.deps import get_current_admin_user, get_current_active_user
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
from app.crud.activity_log import crud_activity_log
from app.crud.user import crud_user

router = APIRouter()


# ============================================
# Response Models
# ============================================

class ActivityLogItem(BaseModel):
    id: str
    user_id: Optional[str]
    user_name: Optional[str]
    user_email: Optional[str]
    project_id: Optional[str]
    project_name: Optional[str]
    action: str
    resource_type: Optional[str]
    resource_id: Optional[str]
    description: Optional[str]
    ip_address: Optional[str]
    created_at: Optional[str]


class ActivityLogsResponse(BaseModel):
    logs: List[ActivityLogItem]
    total: int
    skip: int
    limit: int


class ActionStatsItem(BaseModel):
    action: str
    count: int


class UserActivityStatsItem(BaseModel):
    user_id: str
    full_name: str
    email: str
    activity_count: int


class ActivityStatsResponse(BaseModel):
    action_stats: List[ActionStatsItem]
    user_stats: List[UserActivityStatsItem]
    total_logs: int
    actions: List[str]
    resource_types: List[str]


class OnlineUserItem(BaseModel):
    id: str
    full_name: str
    email: str
    role: Optional[str]
    last_activity: Optional[str]
    is_online: bool


class OnlineUsersResponse(BaseModel):
    online_users: List[OnlineUserItem]
    online_count: int


class UsersWithStatusResponse(BaseModel):
    users: List[OnlineUserItem]
    total: int
    online_count: int


# ============================================
# Activity Logs Endpoints
# ============================================

@router.get("/activity-logs", response_model=ActivityLogsResponse)
async def get_activity_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    user_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    resource_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Get activity logs with optional filters. Admin only."""
    logs = await crud_activity_log.get_logs(
        db,
        skip=skip,
        limit=limit,
        user_id=user_id,
        project_id=project_id,
        resource_id=resource_id,
        action=action,
        resource_type=resource_type,
        date_from=date_from,
        date_to=date_to
    )

    total = await crud_activity_log.count(
        db,
        user_id=user_id,
        project_id=project_id,
        resource_id=resource_id,
        action=action,
        resource_type=resource_type,
        date_from=date_from,
        date_to=date_to
    )

    return ActivityLogsResponse(
        logs=[ActivityLogItem(**log) for log in logs],
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/activity-stats", response_model=ActivityStatsResponse)
async def get_activity_stats(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Get activity statistics. Admin only."""
    action_stats = await crud_activity_log.get_action_stats(db, days=days)
    user_stats = await crud_activity_log.get_user_activity_stats(db, days=days)
    total = await crud_activity_log.count(db)
    actions = await crud_activity_log.get_distinct_actions(db)
    resource_types = await crud_activity_log.get_distinct_resource_types(db)

    return ActivityStatsResponse(
        action_stats=[ActionStatsItem(**s) for s in action_stats],
        user_stats=[UserActivityStatsItem(**s) for s in user_stats],
        total_logs=total,
        actions=actions,
        resource_types=resource_types
    )


# ============================================
# User Presence Endpoints
# ============================================

@router.get("/online-users", response_model=OnlineUsersResponse)
async def get_online_users(
    threshold_minutes: int = Query(5, ge=1, le=60),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get currently online users. Available to all authenticated users."""
    online_users = await crud_user.get_online_users(db, threshold_minutes=threshold_minutes)

    return OnlineUsersResponse(
        online_users=[OnlineUserItem(**u) for u in online_users],
        online_count=len(online_users)
    )


@router.get("/users-status", response_model=UsersWithStatusResponse)
async def get_users_with_status(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    threshold_minutes: int = Query(5, ge=1, le=60),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all users with their online status. Available to all authenticated users."""
    users = await crud_user.get_users_with_status(
        db,
        skip=skip,
        limit=limit,
        threshold_minutes=threshold_minutes
    )

    online_count = sum(1 for u in users if u.get('is_online'))

    return UsersWithStatusResponse(
        users=[OnlineUserItem(**u) for u in users],
        total=len(users),
        online_count=online_count
    )


@router.post("/heartbeat")
async def heartbeat(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update user's last activity timestamp. Call this periodically from frontend."""
    await crud_user.update_activity(db, user_id=str(current_user.id))
    await db.commit()
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


# ============================================
# Database Management Endpoints
# ============================================


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
