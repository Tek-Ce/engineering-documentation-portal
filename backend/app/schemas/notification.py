# ============================================
# FILE: app/schemas/notification.py - FIXED
# ============================================
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone


class NotificationBase(BaseModel):
    """Base notification schema"""
    message: str = Field(..., min_length=1)
    type: str = Field(..., min_length=1, max_length=50)


class NotificationCreate(NotificationBase):
    """Schema for creating a notification"""
    user_id: str
    project_id: Optional[str] = None
    document_id: Optional[str] = None
    
    # Add alias for type field to match API usage
    @property
    def notification_type(self) -> str:
        """Alias for type field"""
        return self.type


class NotificationUpdate(BaseModel):
    """Schema for updating a notification"""
    is_read: Optional[bool] = None


class NotificationResponse(NotificationBase):
    """Schema for notification response"""
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    user_id: str
    project_id: Optional[str] = None
    document_id: Optional[str] = None
    is_read: bool
    created_at: datetime


class NotificationListResponse(BaseModel):
    """
    Schema for list of notifications with pagination
    
    ← MISSING CLASS #1 - Added to fix error on line 13
    """
    notifications: List[NotificationResponse]
    total: int
    unread_count: Optional[int] = 0


class NotificationStats(BaseModel):
    """
    Schema for notification statistics
    
    ← MISSING CLASS #2 - Added to fix error on line 14
    """
    total: int = 0
    unread: int = 0
    read: int = 0