# ============================================
# FILE: app/services/indexer_service.py
# Indexer Service - Pipeline Orchestrator
# [CRAWL] → [EXTRACT] → [CHUNK] → [INDEX] → Search
# ============================================
"""
Indexer Service

Orchestrates the document indexing pipeline:
1. Crawl: Detect new/changed files
2. Extract: Get text from PDF, DOCX, etc.
3. Chunk: Split into semantic segments
4. Index: Generate embeddings and store

This service is designed to be called by:
- Background worker (async job processing)
- API endpoints (manual index triggers)
- Scheduled tasks (periodic crawling)

Usage:
    # Index a single document
    result = await IndexerService.index_document(db, document, job_id)
    
    # Reindex entire project
    result = await IndexerService.reindex_project(db, project_id)
    
    # Crawl for new documents
    result = await CrawlerService.scan_for_new_documents(db)
"""
import uuid
import hashlib
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update, func

from app.models.kb import KBChunk, KBProcessingJob
from app.models.document import Document
from app.models.project import Project
from app.services.text_extractor import TextExtractor, TextChunker
from app.services.embedding_service import EmbeddingService

logger = logging.getLogger(__name__)


class IndexerService:
    """
    Core indexing service.
    
    Handles the full pipeline from file to indexed chunks.
    """
    
    UPLOAD_BASE_PATH = Path("uploads")
    
    @classmethod
    async def index_document(
        cls,
        db: AsyncSession,
        document: Document,
        job_id: Optional[str] = None,
        force_reindex: bool = False
    ) -> Dict[str, Any]:
        """
        Index a single document.
        
        Pipeline:
        1. Load file from disk
        2. Extract text content
        3. Split into chunks
        4. Generate embeddings
        5. Store in database
        
        Args:
            db: Database session
            document: Document model instance
            job_id: Optional job ID for progress tracking
            force_reindex: Delete existing chunks first
            
        Returns:
            Dict with indexing results
        """
        result = {
            "success": False,
            "document_id": str(document.id),
            "document_title": document.title,
            "chunks_created": 0,
            "tokens_indexed": 0,
            "content_hash": None,
            "error": None,
            "duration_ms": 0
        }
        
        start_time = datetime.utcnow()
        
        try:
            # Update job status if tracking
            if job_id:
                await cls._update_job_status(db, job_id, "processing")
            
            # 1. Build full file path
            file_path = cls.UPLOAD_BASE_PATH / document.file_path
            
            if not file_path.exists():
                raise FileNotFoundError(f"File not found: {file_path}")
            
            # 2. Check if already indexed with same content
            if not force_reindex:
                existing_hash = await cls._get_document_hash(db, str(document.id))
                current_hash = cls._compute_file_hash(file_path)
                
                if existing_hash and existing_hash == current_hash:
                    result["success"] = True
                    result["content_hash"] = current_hash
                    result["error"] = "Already indexed (same content)"
                    if job_id:
                        await cls._update_job_completed(db, job_id, 0)
                    return result
            
            # 3. Extract text
            logger.info(f"Extracting text from: {document.file_name}")
            extracted = await TextExtractor.extract(str(file_path))
            
            if not extracted or not extracted.text:
                raise ValueError(f"No text could be extracted from: {document.file_name}")
            
            logger.info(f"Extracted {extracted.word_count} words from {document.file_name}")
            result["content_hash"] = extracted.content_hash
            
            # 4. Chunk text
            chunks = TextChunker.chunk_text(
                extracted.text,
                chunk_size=500,
                chunk_overlap=50,
                respect_paragraphs=True
            )
            
            if not chunks:
                raise ValueError(f"No chunks generated from: {document.file_name}")
            
            logger.info(f"Generated {len(chunks)} chunks")
            
            # Update job with total chunks
            if job_id:
                await cls._update_job_progress(db, job_id, 0, len(chunks))
            
            # 5. Delete existing chunks for this document
            deleted = await cls._delete_document_chunks(db, str(document.id))
            if deleted > 0:
                logger.info(f"Deleted {deleted} existing chunks")
            
            # 6. Generate embeddings in batch (most expensive operation)
            logger.info("Generating embeddings...")
            chunk_texts = [c['text'] for c in chunks]
            embeddings = await EmbeddingService.generate_embeddings_batch(
                chunk_texts,
                batch_size=32,
                show_progress=len(chunk_texts) > 50
            )
            
            # 7. Create chunk records
            total_tokens = 0
            chunk_records = []
            
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                chunk_record = KBChunk(
                    id=str(uuid.uuid4()),
                    project_id=str(document.project_id),
                    document_id=str(document.id),
                    source_type="document",
                    source_id=str(document.id),
                    chunk_text=chunk['text'],
                    chunk_text_fts=chunk['text'],  # Copy for FULLTEXT index
                    chunk_index=chunk['index'],
                    token_count=chunk.get('token_count', 0),
                    embedding=embedding,
                    meta={
                        "file_name": document.file_name,
                        "document_title": document.title,
                        "content_hash": extracted.content_hash,
                        "extraction_method": extracted.extraction_method,
                        "total_chunks": len(chunks)
                    }
                )
                chunk_records.append(chunk_record)
                total_tokens += chunk.get('token_count', 0)
                
                # Update progress periodically
                if job_id and (i + 1) % 10 == 0:
                    await cls._update_job_progress(db, job_id, i + 1, len(chunks))
            
            # 8. Bulk insert chunks
            db.add_all(chunk_records)
            await db.flush()
            
            # 9. Update job as completed
            if job_id:
                await cls._update_job_completed(db, job_id, len(chunk_records))
            
            # Calculate duration
            duration = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            result["success"] = True
            result["chunks_created"] = len(chunk_records)
            result["tokens_indexed"] = total_tokens
            result["duration_ms"] = int(duration)
            
            logger.info(
                f"Successfully indexed {document.file_name}: "
                f"{len(chunk_records)} chunks, {total_tokens} tokens in {duration:.0f}ms"
            )
            
        except Exception as e:
            logger.error(f"Indexing failed for {document.file_name}: {e}")
            result["error"] = str(e)
            result["duration_ms"] = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            
            if job_id:
                await cls._update_job_failed(db, job_id, str(e))
        
        return result
    
    @classmethod
    async def reindex_project(
        cls,
        db: AsyncSession,
        project_id: str,
        force_reindex: bool = False
    ) -> Dict[str, Any]:
        """
        Reindex all documents in a project.
        
        Args:
            db: Database session
            project_id: Project ID
            force_reindex: Reindex even if content unchanged
            
        Returns:
            Dict with reindexing results
        """
        result = {
            "project_id": project_id,
            "total_documents": 0,
            "indexed": 0,
            "skipped": 0,
            "failed": 0,
            "total_chunks": 0,
            "total_tokens": 0,
            "errors": [],
            "duration_ms": 0
        }
        
        start_time = datetime.utcnow()
        
        try:
            # Get all documents for project
            stmt = select(Document).where(Document.project_id == project_id)
            docs_result = await db.execute(stmt)
            documents = docs_result.scalars().all()
            
            result["total_documents"] = len(documents)
            
            for doc in documents:
                doc_result = await cls.index_document(
                    db, doc, force_reindex=force_reindex
                )
                
                if doc_result["success"]:
                    if doc_result.get("error") == "Already indexed (same content)":
                        result["skipped"] += 1
                    else:
                        result["indexed"] += 1
                        result["total_chunks"] += doc_result["chunks_created"]
                        result["total_tokens"] += doc_result["tokens_indexed"]
                else:
                    result["failed"] += 1
                    result["errors"].append({
                        "document_id": str(doc.id),
                        "document_title": doc.title,
                        "error": doc_result["error"]
                    })
            
            await db.commit()
            
        except Exception as e:
            logger.error(f"Project reindexing failed: {e}")
            result["errors"].append({"error": str(e)})
        
        result["duration_ms"] = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        return result
    
    @classmethod
    async def delete_document_index(
        cls,
        db: AsyncSession,
        document_id: str
    ) -> int:
        """Delete all indexed chunks for a document."""
        return await cls._delete_document_chunks(db, document_id)
    
    @classmethod
    async def delete_project_index(
        cls,
        db: AsyncSession,
        project_id: str
    ) -> int:
        """Delete all indexed chunks for a project."""
        stmt = delete(KBChunk).where(KBChunk.project_id == project_id)
        result = await db.execute(stmt)
        return result.rowcount
    
    @classmethod
    async def get_document_index_status(
        cls,
        db: AsyncSession,
        document_id: str
    ) -> Dict[str, Any]:
        """Get indexing status for a document."""
        # Count chunks
        chunk_stmt = select(
            func.count(KBChunk.id),
            func.sum(KBChunk.token_count),
            func.max(KBChunk.indexed_at)
        ).where(KBChunk.document_id == document_id)
        
        chunk_result = await db.execute(chunk_stmt)
        chunk_row = chunk_result.one()
        
        chunk_count = chunk_row[0] or 0
        token_count = chunk_row[1] or 0
        last_indexed = chunk_row[2]
        
        # Get content hash from first chunk
        content_hash = None
        if chunk_count > 0:
            hash_stmt = select(KBChunk.meta).where(
                KBChunk.document_id == document_id
            ).limit(1)
            hash_result = await db.execute(hash_stmt)
            hash_row = hash_result.scalar_one_or_none()
            if hash_row:
                content_hash = hash_row.get("content_hash")
        
        # Get latest job
        job_stmt = select(KBProcessingJob).where(
            KBProcessingJob.document_id == document_id
        ).order_by(KBProcessingJob.created_at.desc()).limit(1)
        
        job_result = await db.execute(job_stmt)
        latest_job = job_result.scalar_one_or_none()
        
        return {
            "document_id": document_id,
            "is_indexed": chunk_count > 0,
            "chunk_count": chunk_count,
            "token_count": token_count,
            "last_indexed": last_indexed,
            "content_hash": content_hash,
            "latest_job_status": latest_job.status if latest_job else None,
            "latest_job_error": latest_job.error_message if latest_job else None
        }
    
    @classmethod
    async def create_indexing_job(
        cls,
        db: AsyncSession,
        document_id: str,
        project_id: str,
        job_type: str = "index_document"
    ) -> str:
        """Create a new indexing job and return job ID."""
        job_id = str(uuid.uuid4())
        
        job = KBProcessingJob(
            id=job_id,
            document_id=document_id,
            project_id=project_id,
            status="queued",
            job_type=job_type,
            progress=0,
            processed_chunks=0
        )
        
        db.add(job)
        await db.flush()
        
        return job_id
    
    # ==========================================
    # Private Helper Methods
    # ==========================================
    
    @classmethod
    def _compute_file_hash(cls, file_path: Path) -> str:
        """Compute MD5 hash of file content."""
        hasher = hashlib.md5()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                hasher.update(chunk)
        return hasher.hexdigest()
    
    @classmethod
    async def _get_document_hash(cls, db: AsyncSession, document_id: str) -> Optional[str]:
        """Get stored content hash for a document."""
        stmt = select(KBChunk.meta).where(
            KBChunk.document_id == document_id
        ).limit(1)
        result = await db.execute(stmt)
        row = result.scalar_one_or_none()
        if row:
            return row.get("content_hash")
        return None
    
    @classmethod
    async def _delete_document_chunks(cls, db: AsyncSession, document_id: str) -> int:
        """Delete all chunks for a document."""
        stmt = delete(KBChunk).where(KBChunk.document_id == document_id)
        result = await db.execute(stmt)
        return result.rowcount
    
    @classmethod
    async def _update_job_status(cls, db: AsyncSession, job_id: str, status: str):
        """Update job status."""
        values = {"status": status}
        if status == "processing":
            values["started_at"] = datetime.utcnow()
        
        stmt = update(KBProcessingJob).where(
            KBProcessingJob.id == job_id
        ).values(**values)
        await db.execute(stmt)
    
    @classmethod
    async def _update_job_progress(
        cls,
        db: AsyncSession,
        job_id: str,
        processed: int,
        total: int
    ):
        """Update job progress."""
        progress = int((processed / total) * 100) if total > 0 else 0
        
        stmt = update(KBProcessingJob).where(
            KBProcessingJob.id == job_id
        ).values(
            progress=progress,
            processed_chunks=processed,
            total_chunks=total
        )
        await db.execute(stmt)
    
    @classmethod
    async def _update_job_completed(
        cls,
        db: AsyncSession,
        job_id: str,
        total_chunks: int
    ):
        """Mark job as completed."""
        stmt = update(KBProcessingJob).where(
            KBProcessingJob.id == job_id
        ).values(
            status="completed",
            progress=100,
            processed_chunks=total_chunks,
            total_chunks=total_chunks,
            completed_at=datetime.utcnow(),
            result={"chunks_created": total_chunks}
        )
        await db.execute(stmt)
    
    @classmethod
    async def _update_job_failed(cls, db: AsyncSession, job_id: str, error: str):
        """Mark job as failed."""
        stmt = update(KBProcessingJob).where(
            KBProcessingJob.id == job_id
        ).values(
            status="failed",
            error_message=error[:1000],  # Truncate error message
            completed_at=datetime.utcnow()
        )
        await db.execute(stmt)


class CrawlerService:
    """
    File system crawler service.
    
    Scans for new/modified documents and queues indexing jobs.
    """
    
    @classmethod
    async def scan_for_new_documents(
        cls,
        db: AsyncSession,
        project_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Scan for documents that need indexing.
        
        Checks all documents in the database and queues indexing
        jobs for those that aren't indexed yet.
        
        Args:
            db: Database session
            project_id: Optional filter by project
            
        Returns:
            Dict with scan results
        """
        result = {
            "scanned": 0,
            "already_indexed": 0,
            "needs_indexing": 0,
            "already_queued": 0,
            "queued": 0,
            "errors": [],
            "duration_ms": 0
        }
        
        start_time = datetime.utcnow()
        
        try:
            # Get all documents
            stmt = select(Document)
            if project_id:
                stmt = stmt.where(Document.project_id == project_id)
            
            docs_result = await db.execute(stmt)
            documents = docs_result.scalars().all()
            
            for doc in documents:
                result["scanned"] += 1
                
                try:
                    # Check if document is indexed
                    status = await IndexerService.get_document_index_status(
                        db, str(doc.id)
                    )
                    
                    if status["is_indexed"]:
                        result["already_indexed"] += 1
                        continue
                    
                    result["needs_indexing"] += 1
                    
                    # Check if already queued
                    if status["latest_job_status"] in ["queued", "processing"]:
                        result["already_queued"] += 1
                        continue
                    
                    # Create indexing job
                    await IndexerService.create_indexing_job(
                        db,
                        document_id=str(doc.id),
                        project_id=str(doc.project_id)
                    )
                    result["queued"] += 1
                    
                except Exception as e:
                    result["errors"].append({
                        "document_id": str(doc.id),
                        "error": str(e)
                    })
            
            await db.commit()
            
        except Exception as e:
            logger.error(f"Crawler scan failed: {e}")
            result["errors"].append({"error": str(e)})
        
        result["duration_ms"] = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        return result
    
    @classmethod
    async def process_pending_jobs(
        cls,
        db: AsyncSession,
        max_jobs: int = 10
    ) -> Dict[str, Any]:
        """
        Process pending indexing jobs.
        
        Picks up queued jobs and processes them sequentially.
        
        Args:
            db: Database session
            max_jobs: Maximum jobs to process in one batch
            
        Returns:
            Dict with processing results
        """
        result = {
            "processed": 0,
            "succeeded": 0,
            "failed": 0,
            "total_chunks": 0,
            "total_tokens": 0,
            "errors": [],
            "duration_ms": 0
        }
        
        start_time = datetime.utcnow()
        
        try:
            # Get pending jobs (oldest first)
            stmt = select(KBProcessingJob).where(
                KBProcessingJob.status == "queued"
            ).order_by(KBProcessingJob.created_at).limit(max_jobs)
            
            jobs_result = await db.execute(stmt)
            jobs = jobs_result.scalars().all()
            
            for job in jobs:
                result["processed"] += 1
                
                try:
                    # Get the document
                    doc_stmt = select(Document).where(Document.id == job.document_id)
                    doc_result = await db.execute(doc_stmt)
                    document = doc_result.scalar_one_or_none()
                    
                    if not document:
                        await IndexerService._update_job_failed(
                            db, str(job.id), "Document not found"
                        )
                        result["failed"] += 1
                        result["errors"].append({
                            "job_id": str(job.id),
                            "error": "Document not found"
                        })
                        continue
                    
                    # Index the document
                    index_result = await IndexerService.index_document(
                        db, document, job_id=str(job.id)
                    )
                    
                    if index_result["success"]:
                        result["succeeded"] += 1
                        result["total_chunks"] += index_result["chunks_created"]
                        result["total_tokens"] += index_result["tokens_indexed"]
                    else:
                        result["failed"] += 1
                        result["errors"].append({
                            "job_id": str(job.id),
                            "document_id": str(document.id),
                            "error": index_result["error"]
                        })
                    
                except Exception as e:
                    logger.error(f"Job processing error: {e}")
                    await IndexerService._update_job_failed(db, str(job.id), str(e))
                    result["failed"] += 1
                    result["errors"].append({
                        "job_id": str(job.id),
                        "error": str(e)
                    })
            
            await db.commit()
            
        except Exception as e:
            logger.error(f"Job processing failed: {e}")
            result["errors"].append({"error": str(e)})
        
        result["duration_ms"] = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        return result
