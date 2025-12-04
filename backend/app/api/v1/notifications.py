# ============================================
# FILE: app/api/v1/notifications.py - UPDATED (Fixed field name)
# ============================================
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.user import User
from app.schemas.notification import (
    NotificationCreate,
    NotificationResponse,
    NotificationListResponse,
    NotificationStats
)
from app.crud.notification import crud_notification
from app.api.deps import get_current_user, get_current_active_user

router = APIRouter()


# ============================================
# Notification Endpoints
# ============================================

@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    unread_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get current user's notifications
    
    - **skip**: Number of notifications to skip (pagination)
    - **limit**: Maximum notifications to return
    - **unread_only**: If true, only return unread notifications
    """
    notifications, total = await crud_notification.get_user_notifications(
        db,
        user_id=str(current_user.id),
        skip=skip,
        limit=limit,
        unread_only=unread_only
    )
    
    return NotificationListResponse(
        notifications=[NotificationResponse.model_validate(n) for n in notifications],
        total=total,
        unread_count=await crud_notification.get_unread_count(
            db, user_id=str(current_user.id)
        ) if not unread_only else total
    )


@router.get("/unread", response_model=NotificationListResponse)
async def list_unread_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get current user's unread notifications only
    
    Convenience endpoint - same as GET / with unread_only=true
    """
    notifications, total = await crud_notification.get_user_notifications(
        db,
        user_id=str(current_user.id),
        skip=skip,
        limit=limit,
        unread_only=True
    )
    
    return NotificationListResponse(
        notifications=[NotificationResponse.model_validate(n) for n in notifications],
        total=total,
        unread_count=total
    )


@router.get("/stats", response_model=NotificationStats)
async def get_notification_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get notification statistics for current user
    
    Returns count of unread notifications
    """
    unread_count = await crud_notification.get_unread_count(
        db,
        user_id=str(current_user.id)
    )
    
    # Get total count
    all_notifications, total_count = await crud_notification.get_user_notifications(
        db,
        user_id=str(current_user.id),
        skip=0,
        limit=1,
        unread_only=False
    )
    
    return NotificationStats(
        total=total_count,
        unread=unread_count,
        read=total_count - unread_count
    )


@router.get("/{notification_id}", response_model=NotificationResponse)
async def get_notification(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get a specific notification
    
    Only the notification owner can view it
    """
    notification = await crud_notification.get(db, id=notification_id)
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    # Check ownership
    if str(notification.user_id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this notification"
        )
    
    return NotificationResponse.model_validate(notification)


@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Mark a notification as read
    """
    notification = await crud_notification.get(db, id=notification_id)
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    # Check ownership
    if str(notification.user_id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this notification"
        )
    
    # Mark as read
    notification = await crud_notification.mark_as_read(db, id=notification_id)
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    await db.commit()
    await db.refresh(notification)
    
    return NotificationResponse.model_validate(notification)


@router.post("/read-all", status_code=status.HTTP_200_OK)
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Mark all user's notifications as read
    
    Returns the number of notifications marked as read
    """
    count = await crud_notification.mark_all_as_read(
        db,
        user_id=str(current_user.id)
    )
    
    await db.commit()
    
    return {
        "message": f"{count} notification(s) marked as read",
        "count": count
    }


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete a notification
    
    Only the notification owner can delete it
    """
    notification = await crud_notification.get(db, id=notification_id)
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    # Check ownership (admin can delete any notification)
    user_role = str(getattr(current_user, 'role', ''))
    if str(notification.user_id) != str(current_user.id) and user_role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this notification"
        )
    
    await crud_notification.delete(db, id=notification_id)
    await db.commit()


@router.delete("/", status_code=status.HTTP_200_OK)
async def delete_all_read_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete all read notifications for current user
    
    Returns the number of notifications deleted
    """
    # Get all read notifications
    notifications, _ = await crud_notification.get_user_notifications(
        db,
        user_id=str(current_user.id),
        skip=0,
        limit=10000,  # Get all
        unread_only=False
    )
    
    # Filter to only read notifications
    read_notifications = [n for n in notifications if getattr(n, 'is_read', False)]
    
    count = 0
    for notification in read_notifications:
        await crud_notification.delete(db, id=str(notification.id))
        count += 1
    
    await db.commit()
    
    return {
        "message": f"{count} read notification(s) deleted",
        "count": count
    }


@router.post("", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
async def create_notification(
    notification_in: NotificationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a notification (Admin only or system use)
    
    Generally notifications are created automatically by the system,
    but this endpoint allows manual creation for testing or admin purposes.
    """
    # Check if user is admin
    user_role = str(getattr(current_user, 'role', ''))
    if user_role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can manually create notifications"
        )
    
    # FIXED: Use .type instead of .notification_type
    notification = await crud_notification.create(
        db,
        user_id=notification_in.user_id,
        message=notification_in.message,
        type=notification_in.type,  # ← FIXED: Changed from notification_type to type
        project_id=notification_in.project_id,
        document_id=notification_in.document_id
    )
    
    await db.commit()
    await db.refresh(notification)
    
    return NotificationResponse.model_validate(notification)