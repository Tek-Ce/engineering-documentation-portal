# ============================================
# FILE 5: app/crud/document.py
# ============================================
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, delete
from sqlalchemy.orm import joinedload
from app.crud.base import CRUDBase
from app.models.document import Document, DocumentVersion, document_reviewers
from app.models.tag import DocumentTag
from app.schemas.document import DocumentCreate, DocumentUpdate
from typing import Optional, List
import uuid

class CRUDDocument(CRUDBase[Document, DocumentCreate, DocumentUpdate]):
    async def get(self, db: AsyncSession, id: str) -> Optional[Document]:
        """Get a single document by ID with tags and reviewers eagerly loaded"""
        result = await db.execute(
            select(Document)
            .where(Document.id == id)
            .options(
                joinedload(Document.tags).joinedload(DocumentTag.tag),
                joinedload(Document.reviewers)
            )
        )
        return result.scalars().unique().one_or_none()

    async def get_project_documents(
        self,
        db: AsyncSession,
        *,
        project_id: str,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        document_type: Optional[str] = None,
        uploaded_by: Optional[str] = None,
    ) -> tuple[List[Document], int]:
        """Get documents in a project with tags and reviewers eagerly loaded"""
        query = select(Document).where(Document.project_id == project_id).options(
            joinedload(Document.tags).joinedload(DocumentTag.tag),
            joinedload(Document.reviewers)
        )

        if status:
            query = query.where(Document.status == status)
        if document_type:
            query = query.where(Document.document_type == document_type)
        if uploaded_by:
            query = query.where(Document.uploaded_by == uploaded_by)

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0  # ✅ ensure it's always int
        
        # Get paginated results
        query = query.offset(skip).limit(limit).order_by(Document.uploaded_at.desc())
        result = await db.execute(query)
        documents = result.scalars().unique().all()  # unique() needed for joinedload collections
        
        return list(documents), total
    
    async def create_with_version(
        self,
        db: AsyncSession,
        *,
        obj_in: DocumentCreate,
        uploaded_by_id: str,
        file_path: str,
        file_name: str,
        file_size: int,
        file_type: str,
        mime_type: str
    ) -> Document:
        """Create document with initial version"""
        # Generate unique IDs
        doc_id = str(uuid.uuid4())
        version_id = str(uuid.uuid4())

        # Create both document and version as a single atomic operation
        db_obj = Document(
            id=doc_id,
            project_id=obj_in.project_id,
            uploaded_by=uploaded_by_id,
            title=obj_in.title,
            description=obj_in.description,
            file_path=file_path,
            file_name=file_name,
            file_size=file_size,
            file_type=file_type,
            mime_type=mime_type,
            status=obj_in.status,
            version=1
        )
        db.add(db_obj)

        version = DocumentVersion(
            id=version_id,
            document_id=doc_id,
            version_number=1,
            file_path=file_path,
            file_size=file_size,
            uploaded_by=uploaded_by_id
        )
        db.add(version)

        # Flush and commit together
        try:
            await db.flush()
            await db.refresh(db_obj)
        except Exception as e:
            # On any error, expunge the objects from session to prevent ID conflicts
            db.expunge(db_obj)
            db.expunge(version)
            raise

        return db_obj
    
    async def create_new_version(
        self,
        db: AsyncSession,
        *,
        document: Document,
        file_path: str,
        file_size: int,
        uploaded_by_id: str,
        change_notes: Optional[str] = None,
        file_name: Optional[str] = None
    ) -> DocumentVersion:
        """Create new version of document"""
        # ✅ type-ignore used for SQLAlchemy-managed attributes
        document.version = (document.version or 0) + 1  # type: ignore
        document.file_path = file_path  # type: ignore
        document.file_size = file_size  # type: ignore
        if file_name:
            document.file_name = file_name  # type: ignore
        version = DocumentVersion(
            id=str(uuid.uuid4()),
            document_id=document.id,
            version_number=document.version,
            file_path=file_path,
            file_size=file_size,
            uploaded_by=uploaded_by_id,
            change_notes=change_notes
        )
        db.add(version)
        await db.flush()
        await db.refresh(document)
        await db.refresh(version)
        
        return version
    
    async def get_versions(
        self, db: AsyncSession, *, document_id: str
    ) -> List[DocumentVersion]:
        """Get all versions of a document"""
        result = await db.execute(
            select(DocumentVersion)
            .where(DocumentVersion.document_id == document_id)
            .order_by(DocumentVersion.version_number.desc())
        )
        return list(result.scalars().all())
    
    async def search(
        self,
        db: AsyncSession,
        *,
        query: str,
        project_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Document]:
        """Search documents by title or description"""
        search_query = select(Document).where(
            or_(
                Document.title.ilike(f"%{query}%"),
                Document.description.ilike(f"%{query}%")
            )
        )
        
        if project_id:
            search_query = search_query.where(Document.project_id == project_id)
        
        search_query = search_query.offset(skip).limit(limit)
        result = await db.execute(search_query)
        return list(result.scalars().all())

    async def update_document_tags(
        self,
        db: AsyncSession,
        *,
        document_id: str,
        tag_ids: List[str]
    ) -> None:
        """Update document tags - replaces all existing tags"""
        # Delete existing tags
        await db.execute(
            delete(DocumentTag).where(DocumentTag.document_id == document_id)
        )

        # Add new tags
        for tag_id in tag_ids:
            document_tag = DocumentTag(
                document_id=document_id,
                tag_id=tag_id
            )
            db.add(document_tag)

        await db.flush()

    async def update_document_reviewers(
        self,
        db: AsyncSession,
        *,
        document_id: str,
        reviewer_ids: List[str]
    ) -> None:
        """Update document reviewers - replaces all existing reviewers"""
        # Delete existing reviewers
        await db.execute(
            delete(document_reviewers).where(document_reviewers.c.document_id == document_id)
        )

        # Add new reviewers
        for reviewer_id in reviewer_ids:
            await db.execute(
                document_reviewers.insert().values(
                    document_id=document_id,
                    user_id=reviewer_id
                )
            )

        await db.flush()

crud_document = CRUDDocument(Document)
