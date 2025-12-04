"""
Indexer Service (MVP)
Orchestrates document processing, embedding, and storage
"""
import uuid
import json
from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models.kb import KBChunk, KBProcessingJob
from app.services.kb.document_processor import get_document_processor
from app.services.kb.embedding_service import get_embedding_service


class IndexerService:
    """Indexes documents into the knowledge base"""

    def __init__(self):
        self.processor = get_document_processor()
        self.embedder = get_embedding_service()

    async def index_document(
        self,
        db: AsyncSession,
        document_id: str,
        project_id: str,
        file_path: str,
        source_type: str = "document"
    ) -> str:
        """
        Index a document into the knowledge base

        Args:
            db: Database session
            document_id: UUID of document
            project_id: UUID of project
            file_path: Path to document file
            source_type: Type of source ('document', 'comment', 'version_note')

        Returns:
            Job ID for tracking progress
        """
        # Create processing job
        job_id = str(uuid.uuid4())
        job = KBProcessingJob(
            id=job_id,
            document_id=document_id,
            project_id=project_id,
            job_type="index_document",
            status='queued',
            progress=0,
            processed_chunks=0
        )
        db.add(job)
        await db.commit()

        # Process immediately (in MVP, no background workers)
        try:
            await self._process_indexing_job(db, job, file_path, source_type)
        except Exception as e:
            # Update job status
            job.status = 'failed'
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            await db.commit()
            raise

        return job_id

    async def _process_indexing_job(
        self,
        db: AsyncSession,
        job: KBProcessingJob,
        file_path: str,
        source_type: str = "document"
    ):
        """Process an indexing job"""
        # Update status
        job.status = 'processing'
        job.started_at = datetime.utcnow()
        await db.commit()

        # Get job details
        document_id = job.document_id
        project_id = job.project_id

        try:
            # Delete existing chunks for this document
            await db.execute(
                delete(KBChunk).where(KBChunk.document_id == document_id)
            )
            await db.commit()

            # Process document into chunks
            chunks = await self.processor.process_document(
                file_path=file_path,
                document_id=document_id,
                project_id=project_id
            )

            if not chunks:
                job.status = 'completed'
                job.total_chunks = 0
                job.processed_chunks = 0
                job.progress = 100
                job.result = {'chunks_created': 0}
                job.completed_at = datetime.utcnow()
                await db.commit()
                return

            # Generate embeddings for all chunks
            chunk_texts = [chunk.text for chunk in chunks]
            embeddings = await self.embedder.embed_batch(chunk_texts)

            # Store chunks in database
            chunk_records = []
            for chunk, embedding in zip(chunks, embeddings):
                chunk_record = KBChunk(
                    id=chunk.id,
                    project_id=project_id,
                    document_id=document_id,
                    source_type=source_type,
                    source_id=document_id,  # For document chunks, source_id is same as document_id
                    chunk_text=chunk.text,
                    chunk_index=chunk.chunk_index,
                    token_count=chunk.token_count,
                    embedding=json.dumps(embedding),  # Store as JSON string
                    meta=json.dumps({
                        'chunk_index': chunk.chunk_index,
                        'token_count': chunk.token_count,
                        **chunk.metadata
                    })
                )
                chunk_records.append(chunk_record)

            # Bulk insert
            db.add_all(chunk_records)
            await db.commit()

            # Update job status
            job.status = 'completed'
            job.total_chunks = len(chunk_records)
            job.processed_chunks = len(chunk_records)
            job.progress = 100
            job.result = {
                'chunks_created': len(chunk_records),
                'embedding_dim': len(embeddings[0]) if embeddings else 0
            }
            job.completed_at = datetime.utcnow()
            await db.commit()

        except Exception as e:
            job.status = 'failed'
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            await db.commit()
            raise

    async def reindex_project(
        self,
        db: AsyncSession,
        project_id: str
    ) -> Dict[str, Any]:
        """
        Reindex all documents in a project

        Args:
            db: Database session
            project_id: UUID of project

        Returns:
            Summary of reindexing
        """
        # Delete all existing chunks for this project
        result = await db.execute(
            delete(KBChunk).where(KBChunk.project_id == project_id)
        )
        deleted_count = result.rowcount
        await db.commit()

        return {
            'project_id': project_id,
            'chunks_deleted': deleted_count,
            'status': 'ready_for_reindex'
        }

    async def get_job_status(
        self,
        db: AsyncSession,
        job_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get status of an indexing job

        Args:
            db: Database session
            job_id: UUID of job

        Returns:
            Job status dict or None if not found
        """
        result = await db.execute(
            select(KBProcessingJob).where(KBProcessingJob.id == job_id)
        )
        job = result.scalar_one_or_none()

        if not job:
            return None

        return {
            'job_id': job.id,
            'document_id': job.document_id,
            'project_id': job.project_id,
            'job_type': job.job_type,
            'status': job.status,
            'progress': job.progress,
            'total_chunks': job.total_chunks,
            'processed_chunks': job.processed_chunks,
            'error_message': job.error_message,
            'result': job.result,
            'created_at': job.created_at.isoformat() if job.created_at else None,
            'started_at': job.started_at.isoformat() if job.started_at else None,
            'completed_at': job.completed_at.isoformat() if job.completed_at else None
        }


# Singleton instance
_indexer_instance = None

def get_indexer() -> IndexerService:
    """Get singleton IndexerService instance"""
    global _indexer_instance
    if _indexer_instance is None:
        _indexer_instance = IndexerService()
    return _indexer_instance
