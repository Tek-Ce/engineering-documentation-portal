# ============================================
# FILE: app/crud/project_comment.py
# ============================================
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.crud.base import CRUDBase
from app.models.comment import ProjectComment
from app.schemas.comment import ProjectCommentCreate, ProjectCommentUpdate
import uuid


class CRUDProjectComment(CRUDBase[ProjectComment, ProjectCommentCreate, ProjectCommentUpdate]):
    """CRUD operations for Project Comments"""

    async def create(
        self,
        db: AsyncSession,
        *,
        obj_in: ProjectCommentCreate,
        user_id: str
    ) -> ProjectComment:
        """Create new project comment"""
        db_obj = ProjectComment(
            id=str(uuid.uuid4()),
            project_id=obj_in.project_id,
            user_id=user_id,
            parent_comment_id=obj_in.parent_comment_id,
            content=obj_in.content,
            is_resolved=False
        )
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def get_by_project(
        self,
        db: AsyncSession,
        *,
        project_id: str,
        skip: int = 0,
        limit: int = 100,
        include_resolved: bool = True
    ) -> List[ProjectComment]:
        """Get all comments for a project (only top-level comments)"""
        query = select(ProjectComment).where(
            ProjectComment.project_id == project_id,
            ProjectComment.parent_comment_id == None  # Only top-level comments
        )

        if not include_resolved:
            query = query.where(ProjectComment.is_resolved == False)

        query = query.offset(skip).limit(limit).order_by(ProjectComment.created_at.desc())

        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_with_replies(
        self,
        db: AsyncSession,
        *,
        comment_id: str
    ) -> Optional[ProjectComment]:
        """Get a comment with all its replies"""
        result = await db.execute(
            select(ProjectComment)
            .options(selectinload(ProjectComment.replies))
            .where(ProjectComment.id == comment_id)
        )
        return result.scalar_one_or_none()

    async def count_by_project(
        self,
        db: AsyncSession,
        *,
        project_id: str,
        include_resolved: bool = True
    ) -> int:
        """Count comments for a project"""
        query = select(func.count()).select_from(ProjectComment).where(
            ProjectComment.project_id == project_id,
            ProjectComment.parent_comment_id == None  # Only top-level comments
        )

        if not include_resolved:
            query = query.where(ProjectComment.is_resolved == False)

        result = await db.execute(query)
        return result.scalar() or 0

    async def update_resolved_status(
        self,
        db: AsyncSession,
        *,
        comment_id: str,
        is_resolved: bool
    ) -> Optional[ProjectComment]:
        """Update the resolved status of a comment"""
        comment = await self.get(db, id=comment_id)
        if comment:
            comment.is_resolved = is_resolved  # type: ignore[assignment]
            db.add(comment)
            await db.flush()
            await db.refresh(comment)
        return comment


crud_project_comment = CRUDProjectComment(ProjectComment)
