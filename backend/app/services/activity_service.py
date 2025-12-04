# ============================================
# FILE: app/services/activity_service.py
# ============================================
"""
Activity Service - Log user activities
"""
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
import uuid


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
        Log an activity
        
        Actions: DOCUMENT_UPLOADED, DOCUMENT_UPDATED, DOCUMENT_DELETED,
                 PROJECT_CREATED, COMMENT_ADDED, etc.
        """
        # You can store activities in database or log them
        # For now, we'll create a simple activity log
        
        activity_data = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "description": description,
            "project_id": project_id,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "timestamp": datetime.now(timezone.utc)

        }
        
        # TODO: Store in activity_logs table if you have one
        # For now, just log it
        print(f"[ACTIVITY] {action} by user {user_id}: {description}")
        
        return activity_data
    
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