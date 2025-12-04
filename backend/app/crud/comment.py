# ============================================
# FILE 6: app/crud/comment.py
# ============================================
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.crud.base import CRUDBase
from app.models.comment import Comment
from app.schemas.comment import CommentCreate, CommentUpdate
from typing import List, Optional  # ✅ Added Optional import
import uuid

class CRUDComment(CRUDBase[Comment, CommentCreate, CommentUpdate]):
    async def get_document_comments(
        self, db: AsyncSession, *, document_id: str
    ) -> List[Comment]:
        """Get all comments for a document with user details"""
        result = await db.execute(
            select(Comment)
            .options(selectinload(Comment.user))  # Eagerly load user
            .options(selectinload(Comment.replies))  # Eagerly load replies
            .where(Comment.document_id == document_id)
            .order_by(Comment.created_at.asc())
        )
        return list(result.scalars().all())
    
    async def create(
        self,
        db: AsyncSession,
        *,
        obj_in: CommentCreate,
        user_id: str
    ) -> Comment:
        """Create comment"""
        db_obj = Comment(
            id=str(uuid.uuid4()),
            document_id=obj_in.document_id,
            user_id=user_id,
            parent_comment_id=obj_in.parent_comment_id,
            content=obj_in.content
        )
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj
    
    async def resolve(self, db: AsyncSession, *, comment_id: str) -> Optional[Comment]:
        """Mark comment as resolved"""
        comment = await self.get(db, id=comment_id)
        if comment:
            # ✅ Use setattr() instead of direct assignment to a SQLAlchemy column
            setattr(comment, "is_resolved", True)
            await db.flush()
            await db.refresh(comment)
        return comment

# ✅ Instantiate CRUD
crud_comment = CRUDComment(Comment)
