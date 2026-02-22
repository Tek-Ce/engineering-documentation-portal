# ============================================
# FILE 7: app/crud/tag.py
# ============================================
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.crud.base import CRUDBase
from app.models.tag import Tag, DocumentTag
from app.schemas.tag import TagCreate, TagUpdate
from typing import List, Optional
import uuid

class CRUDTag(CRUDBase[Tag, TagCreate, TagUpdate]):
    async def get_by_name(self, db: AsyncSession, *, name: str) -> Optional[Tag]:
        """Get tag by name"""
        result = await db.execute(select(Tag).where(Tag.name == name))
        return result.scalar_one_or_none()
    
    async def get_document_tags(
        self, db: AsyncSession, *, document_id: str
    ) -> List[Tag]:
        """Get tags for a document"""
        result = await db.execute(
            select(Tag)
            .join(DocumentTag, Tag.id == DocumentTag.tag_id)
            .where(DocumentTag.document_id == document_id)
        )
        return list(result.scalars().all())
    
    async def add_tag_to_document(
        self,
        db: AsyncSession,
        *,
        document_id: str,
        tag_id: str,
        tagged_by_id: str
    ) -> DocumentTag:
        """Add tag to document"""
        doc_tag = DocumentTag(
            document_id=document_id,
            tag_id=tag_id,
            tagged_by=tagged_by_id
        )
        db.add(doc_tag)
        await db.flush()
        return doc_tag
    
    async def remove_tag_from_document(
        self, db: AsyncSession, *, document_id: str, tag_id: str
    ) -> bool:
        """Remove tag from document"""
        result = await db.execute(
            select(DocumentTag).where(
                DocumentTag.document_id == document_id,
                DocumentTag.tag_id == tag_id
            )
        )
        doc_tag = result.scalar_one_or_none()
        if doc_tag:
            await db.delete(doc_tag)
            await db.flush()
            return True
        return False
    
    async def create(self, db: AsyncSession, *, obj_in: TagCreate) -> Tag:
        """Create tag"""
        db_obj = Tag(
            id=str(uuid.uuid4()),
            name=obj_in.name,
            color=obj_in.color
        )
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

crud_tag = CRUDTag(Tag)
