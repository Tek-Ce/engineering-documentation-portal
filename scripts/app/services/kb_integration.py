# ============================================
# FILE: app/services/kb_integration.py
# Knowledge Base Integration Service
# Auto-indexing hooks for document lifecycle
# ============================================
import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.models.document import Document
from app.models.kb import KBChunk, KBProcessingJob
from app.crud.kb import crud_kb_job, crud_kb_chunk

logger = logging.getLogger(__name__)


class KBIntegration:
    """
    Integration service that hooks KB indexing into the document lifecycle.
    
    Automatically:
    - Queues indexing when documents are uploaded
    - Re-indexes when documents are updated
    - Removes index when documents are deleted
    """
    
    @classmethod
    async def on_document_uploaded(
        cls,
        db: AsyncSession,
        document_id: str,
        project_id: str,
        auto_index: bool = True
    ) -> Optional[str]:
        """
        Called after a document is uploaded.
        Queues the document for indexing.
        
        Args:
            db: Database session
            document_id: ID of the uploaded document
            project_id: ID of the project
            auto_index: Whether to auto-queue for indexing
            
        Returns:
            Job ID if queued, None otherwise
        """
        if not auto_index:
            logger.info(f"Auto-indexing disabled for document {document_id}")
            return None
        
        try:
            # Check if document is indexable (supported file type)
            stmt = select(Document).where(Document.id == document_id)
            result = await db.execute(stmt)
            document = result.scalar_one_or_none()
            
            if not document:
                logger.warning(f"Document not found for indexing: {document_id}")
                return None
            
            # Check file type
            if not cls._is_indexable(document.file_type):
                logger.info(f"Document type not indexable: {document.file_type}")
                return None
            
            # Check if already queued
            existing_job = await cls._get_pending_job(db, document_id)
            if existing_job:
                logger.info(f"Document already queued for indexing: {document_id}")
                return str(existing_job.id)
            
            # Create indexing job
            job = await crud_kb_job.create(
                db,
                document_id=document_id,
                project_id=project_id,
                job_type="index_document"
            )
            
            logger.info(f"Queued document for indexing: {document_id} (job: {job.id})")
            return str(job.id)
            
        except Exception as e:
            logger.error(f"Failed to queue document for indexing: {e}")
            return None
    
    @classmethod
    async def on_document_updated(
        cls,
        db: AsyncSession,
        document_id: str,
        project_id: str,
        file_changed: bool = False
    ) -> Optional[str]:
        """
        Called after a document is updated.
        Re-indexes if the file content changed.
        
        Args:
            db: Database session
            document_id: ID of the updated document
            project_id: ID of the project
            file_changed: Whether the actual file was replaced
            
        Returns:
            Job ID if re-indexing queued, None otherwise
        """
        if not file_changed:
            # Only metadata changed, no need to re-index
            return None
        
        try:
            # Delete existing index
            deleted = await crud_kb_chunk.delete_by_document(db, document_id)
            logger.info(f"Deleted {deleted} existing chunks for document {document_id}")
            
            # Queue for re-indexing
            return await cls.on_document_uploaded(db, document_id, project_id)
            
        except Exception as e:
            logger.error(f"Failed to handle document update: {e}")
            return None
    
    @classmethod
    async def on_document_deleted(
        cls,
        db: AsyncSession,
        document_id: str
    ) -> int:
        """
        Called before/after a document is deleted.
        Removes all indexed data for the document.
        
        Args:
            db: Database session
            document_id: ID of the deleted document
            
        Returns:
            Number of chunks deleted
        """
        try:
            # Delete all chunks
            deleted_chunks = await crud_kb_chunk.delete_by_document(db, document_id)
            
            # Cancel any pending jobs
            await cls._cancel_pending_jobs(db, document_id)
            
            logger.info(f"Cleaned up index for deleted document {document_id}: {deleted_chunks} chunks")
            return deleted_chunks
            
        except Exception as e:
            logger.error(f"Failed to clean up document index: {e}")
            return 0
    
    @classmethod
    async def on_new_version_uploaded(
        cls,
        db: AsyncSession,
        document_id: str,
        project_id: str
    ) -> Optional[str]:
        """
        Called when a new version of a document is uploaded.
        Triggers re-indexing with new content.
        
        Args:
            db: Database session
            document_id: ID of the document
            project_id: ID of the project
            
        Returns:
            Job ID if queued, None otherwise
        """
        return await cls.on_document_updated(
            db, document_id, project_id, file_changed=True
        )
    
    # ==========================================
    # Helper Methods
    # ==========================================
    
    @classmethod
    def _is_indexable(cls, file_type: Optional[str]) -> bool:
        """Check if file type is indexable"""
        if not file_type:
            return False
        
        indexable_types = {
            'pdf', 'docx', 'doc', 'txt', 'md', 'markdown',
            'rtf', 'html', 'htm', 'csv', 'json', 'xml'
        }
        
        return file_type.lower().lstrip('.') in indexable_types
    
    @classmethod
    async def _get_pending_job(
        cls,
        db: AsyncSession,
        document_id: str
    ) -> Optional[KBProcessingJob]:
        """Get pending job for a document"""
        stmt = select(KBProcessingJob).where(
            KBProcessingJob.document_id == document_id,
            KBProcessingJob.status.in_(["queued", "processing"])
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    @classmethod
    async def _cancel_pending_jobs(
        cls,
        db: AsyncSession,
        document_id: str
    ):
        """Cancel all pending jobs for a document"""
        stmt = update(KBProcessingJob).where(
            KBProcessingJob.document_id == document_id,
            KBProcessingJob.status == "queued"
        ).values(status="cancelled")
        
        await db.execute(stmt)


# Convenience function for use in document endpoints
async def queue_document_indexing(
    db: AsyncSession,
    document_id: str,
    project_id: str
) -> Optional[str]:
    """
    Queue a document for KB indexing.
    
    Use this in document upload/update endpoints.
    """
    return await KBIntegration.on_document_uploaded(
        db, document_id, project_id, auto_index=True
    )
