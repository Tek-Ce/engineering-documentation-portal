"""
CRUD operations for ProjectMember model
"""
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, delete
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone

from app.crud.base import CRUDBase
from app.models.project_member import ProjectMember
from app.models.user import User
from app.schemas.project_member import ProjectMemberCreate, ProjectMemberUpdate
import uuid


class CRUDProjectMember(CRUDBase[ProjectMember, ProjectMemberCreate, ProjectMemberUpdate]):
    """CRUD operations for ProjectMember"""
    
    async def create(
        self, 
        db: AsyncSession, 
        *, 
        obj_in: ProjectMemberCreate,
        added_by: str
    ) -> ProjectMember:
        """Add member to project"""
        db_obj = ProjectMember(
            id=str(uuid.uuid4()),
            project_id=obj_in.project_id,
            user_id=obj_in.user_id,
            role=getattr(obj_in, 'role', 'MEMBER'),
            added_by=added_by
        )
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj
    
    async def get_project_members(
        self,
        db: AsyncSession,
        *,
        project_id: str
    ) -> List[ProjectMember]:
        """Get all members of a project with user details"""
        result = await db.execute(
            select(ProjectMember)
            .options(selectinload(ProjectMember.user))
            .where(ProjectMember.project_id == project_id)
            .order_by(ProjectMember.added_at.desc())
        )
        return list(result.scalars().all())
    
    async def get_user_projects(
        self,
        db: AsyncSession,
        *,
        user_id: str
    ) -> List[ProjectMember]:
        """Get all projects a user is member of"""
        result = await db.execute(
            select(ProjectMember)
            .where(ProjectMember.user_id == user_id)
            .order_by(ProjectMember.added_at.desc())
        )
        return list(result.scalars().all())
    
    async def get_member(
        self, 
        db: AsyncSession, 
        *, 
        project_id: str,
        user_id: str
    ) -> Optional[ProjectMember]:
        """Get specific project member"""
        result = await db.execute(
            select(ProjectMember)
            .where(
                and_(
                    ProjectMember.project_id == project_id,
                    ProjectMember.user_id == user_id
                )
            )
        )
        return result.scalar_one_or_none()
    
    async def is_member(
        self, 
        db: AsyncSession, 
        *, 
        project_id: str,
        user_id: str
    ) -> bool:
        """Check if user is member of project"""
        member = await self.get_member(db, project_id=project_id, user_id=user_id)
        return member is not None
    
    async def update_role(
        self, 
        db: AsyncSession, 
        *, 
        project_id: str,
        user_id: str,
        role: str
    ) -> Optional[ProjectMember]:
        """Update member's role in project"""
        member = await self.get_member(db, project_id=project_id, user_id=user_id)
        if member:
            setattr(member, 'role', role)  # type: ignore[arg-type]
            db.add(member)
            await db.flush()
            await db.refresh(member)
        return member
    
    async def remove_member(
        self, 
        db: AsyncSession, 
        *, 
        project_id: str,
        user_id: str
    ) -> bool:
        """Remove member from project"""
        result = await db.execute(
            delete(ProjectMember)
            .where(
                and_(
                    ProjectMember.project_id == project_id,
                    ProjectMember.user_id == user_id
                )
            )
        )
        await db.flush()
        return (result.rowcount or 0) > 0
    
    async def count_members(
        self, 
        db: AsyncSession, 
        *, 
        project_id: str
    ) -> int:
        """Count members in a project"""
        result = await db.execute(
            select(func.count())
            .select_from(ProjectMember)
            .where(ProjectMember.project_id == project_id)
        )
        count = result.scalar()
        return count if count is not None else 0
    
    async def get_by_role(
        self,
        db: AsyncSession,
        *,
        project_id: str,
        role: str
    ) -> List[ProjectMember]:
        """Get members by role in project"""
        result = await db.execute(
            select(ProjectMember)
            .where(
                and_(
                    ProjectMember.project_id == project_id,
                    ProjectMember.role == role
                )
            )
            .order_by(ProjectMember.added_at.desc())
        )
        return list(result.scalars().all())
    
    async def bulk_add_members(
        self, 
        db: AsyncSession, 
        *, 
        project_id: str,
        user_ids: List[str],
        role: str = "MEMBER",
        added_by: str
    ) -> List[ProjectMember]:
        """Add multiple members to project"""
        members = []
        for user_id in user_ids:
            # Check if already a member
            existing = await self.get_member(db, project_id=project_id, user_id=user_id)
            if not existing:
                db_obj = ProjectMember(
                    id=str(uuid.uuid4()),
                    project_id=project_id,
                    user_id=user_id,
                    role=role,
                    added_by=added_by
                )
                members.append(db_obj)
                db.add(db_obj)
        
        await db.flush()
        
        # Refresh all members
        for member in members:
            await db.refresh(member)
        
        return members


crud_project_member = CRUDProjectMember(ProjectMember)
