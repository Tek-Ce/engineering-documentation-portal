# ============================================
# FILE: app/crud/kb.py
# Knowledge Base CRUD Operations
# ============================================
import uuid
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update, func, and_

from app.models.kb import (
    KBChunk,
    KBSummary,
    KBProcessingJob,
    KBSettings,
    KBAuditLog
)


class CRUDKBChunk:
    """CRUD operations for KB Chunks"""
    
    async def get(self, db: AsyncSession, id: str) -> Optional[KBChunk]:
        result = await db.execute(select(KBChunk).where(KBChunk.id == id))
        return result.scalar_one_or_none()
    
    async def get_by_document(self, db: AsyncSession, document_id: str, skip: int = 0, limit: int = 100) -> Tuple[List[KBChunk], int]:
        count_result = await db.execute(select(func.count(KBChunk.id)).where(KBChunk.document_id == document_id))
        total = count_result.scalar() or 0
        
        stmt = select(KBChunk).where(KBChunk.document_id == document_id).order_by(KBChunk.chunk_index).offset(skip).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all()), total
    
    async def get_by_project(self, db: AsyncSession, project_id: str, skip: int = 0, limit: int = 100) -> Tuple[List[KBChunk], int]:
        count_result = await db.execute(select(func.count(KBChunk.id)).where(KBChunk.project_id == project_id))
        total = count_result.scalar() or 0
        
        stmt = select(KBChunk).where(KBChunk.project_id == project_id).offset(skip).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all()), total
    
    async def create(self, db: AsyncSession, *, project_id: str, document_id: Optional[str], source_type: str, 
                     source_id: str, chunk_text: str, chunk_index: int, token_count: int, embedding: List[float],
                     metadata: Optional[Dict[str, Any]] = None) -> KBChunk:
        chunk = KBChunk(
            id=str(uuid.uuid4()),
            project_id=project_id,
            document_id=document_id,
            source_type=source_type,
            source_id=source_id,
            chunk_text=chunk_text,
            chunk_text_fts=chunk_text,
            chunk_index=chunk_index,
            token_count=token_count,
            embedding=embedding,
            meta=metadata
        )
        db.add(chunk)
        await db.flush()
        return chunk
    
    async def delete(self, db: AsyncSession, id: str) -> bool:
        result = await db.execute(delete(KBChunk).where(KBChunk.id == id))
        return result.rowcount > 0
    
    async def delete_by_document(self, db: AsyncSession, document_id: str) -> int:
        result = await db.execute(delete(KBChunk).where(KBChunk.document_id == document_id))
        return result.rowcount
    
    async def delete_by_project(self, db: AsyncSession, project_id: str) -> int:
        result = await db.execute(delete(KBChunk).where(KBChunk.project_id == project_id))
        return result.rowcount
    
    async def get_stats(self, db: AsyncSession, project_id: Optional[str] = None) -> Dict[str, Any]:
        if project_id:
            count_stmt = select(func.count(KBChunk.id)).where(KBChunk.project_id == project_id)
            token_stmt = select(func.sum(KBChunk.token_count)).where(KBChunk.project_id == project_id)
        else:
            count_stmt = select(func.count(KBChunk.id))
            token_stmt = select(func.sum(KBChunk.token_count))
        
        count_result = await db.execute(count_stmt)
        token_result = await db.execute(token_stmt)
        
        return {"total_chunks": count_result.scalar() or 0, "total_tokens": token_result.scalar() or 0}


class CRUDKBJob:
    """CRUD operations for KB Processing Jobs"""
    
    async def get(self, db: AsyncSession, id: str) -> Optional[KBProcessingJob]:
        result = await db.execute(select(KBProcessingJob).where(KBProcessingJob.id == id))
        return result.scalar_one_or_none()
    
    async def get_by_document(self, db: AsyncSession, document_id: str) -> List[KBProcessingJob]:
        stmt = select(KBProcessingJob).where(KBProcessingJob.document_id == document_id).order_by(KBProcessingJob.created_at.desc())
        result = await db.execute(stmt)
        return list(result.scalars().all())
    
    async def get_pending(self, db: AsyncSession, limit: int = 10) -> List[KBProcessingJob]:
        stmt = select(KBProcessingJob).where(KBProcessingJob.status == "queued").order_by(KBProcessingJob.created_at).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())
    
    async def create(self, db: AsyncSession, *, document_id: str, project_id: str, job_type: str = "index_document") -> KBProcessingJob:
        job = KBProcessingJob(
            id=str(uuid.uuid4()),
            document_id=document_id,
            project_id=project_id,
            status="queued",
            job_type=job_type,
            progress=0,
            processed_chunks=0
        )
        db.add(job)
        await db.flush()
        return job
    
    async def update_status(self, db: AsyncSession, id: str, status: str, error_message: Optional[str] = None) -> Optional[KBProcessingJob]:
        values = {"status": status}
        if status == "processing":
            values["started_at"] = datetime.utcnow()
        elif status in ["completed", "failed"]:
            values["completed_at"] = datetime.utcnow()
        if error_message:
            values["error_message"] = error_message
        
        await db.execute(update(KBProcessingJob).where(KBProcessingJob.id == id).values(**values))
        return await self.get(db, id)
    
    async def update_progress(self, db: AsyncSession, id: str, progress: int, processed_chunks: int, total_chunks: int):
        await db.execute(update(KBProcessingJob).where(KBProcessingJob.id == id).values(
            progress=progress, processed_chunks=processed_chunks, total_chunks=total_chunks
        ))
    
    async def get_stats(self, db: AsyncSession) -> Dict[str, int]:
        result = {}
        for status in ["queued", "processing", "completed", "failed"]:
            count_result = await db.execute(select(func.count(KBProcessingJob.id)).where(KBProcessingJob.status == status))
            result[status] = count_result.scalar() or 0
        return result


class CRUDKBSettings:
    """CRUD operations for KB Settings"""
    
    async def get_by_project(self, db: AsyncSession, project_id: str) -> Optional[KBSettings]:
        result = await db.execute(select(KBSettings).where(KBSettings.project_id == project_id))
        return result.scalar_one_or_none()
    
    async def get_or_create(self, db: AsyncSession, project_id: str) -> KBSettings:
        settings = await self.get_by_project(db, project_id)
        if not settings:
            settings = KBSettings(id=str(uuid.uuid4()), project_id=project_id)
            db.add(settings)
            await db.flush()
        return settings
    
    async def update(self, db: AsyncSession, project_id: str, **kwargs) -> KBSettings:
        settings = await self.get_or_create(db, project_id)
        for key, value in kwargs.items():
            if hasattr(settings, key) and value is not None:
                setattr(settings, key, value)
        await db.flush()
        return settings


class CRUDKBAudit:
    """CRUD operations for KB Audit Log"""
    
    async def log(self, db: AsyncSession, *, user_id: Optional[str], project_id: Optional[str], action: str,
                  llm_provider: Optional[str] = None, input_tokens: Optional[int] = None,
                  output_tokens: Optional[int] = None, cost: Optional[float] = None,
                  query: Optional[str] = None, response_time_ms: Optional[int] = None) -> KBAuditLog:
        log_entry = KBAuditLog(
            id=str(uuid.uuid4()),
            user_id=user_id,
            project_id=project_id,
            action=action,
            llm_provider=llm_provider,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost=cost,
            query=query,
            response_time_ms=response_time_ms
        )
        db.add(log_entry)
        await db.flush()
        return log_entry
    
    async def get_by_project(self, db: AsyncSession, project_id: str, skip: int = 0, limit: int = 100) -> List[KBAuditLog]:
        stmt = select(KBAuditLog).where(KBAuditLog.project_id == project_id).order_by(KBAuditLog.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())
    
    async def get_usage_stats(self, db: AsyncSession, project_id: Optional[str] = None, days: int = 30) -> Dict[str, Any]:
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        conditions = [KBAuditLog.created_at >= cutoff]
        if project_id:
            conditions.append(KBAuditLog.project_id == project_id)
        
        stmt = select(
            func.count(KBAuditLog.id).label("query_count"),
            func.sum(KBAuditLog.input_tokens).label("total_input_tokens"),
            func.sum(KBAuditLog.output_tokens).label("total_output_tokens"),
            func.sum(KBAuditLog.cost).label("total_cost")
        ).where(and_(*conditions))
        
        result = await db.execute(stmt)
        row = result.one()
        
        return {
            "query_count": row.query_count or 0,
            "total_input_tokens": row.total_input_tokens or 0,
            "total_output_tokens": row.total_output_tokens or 0,
            "total_cost": float(row.total_cost or 0)
        }


# Singleton instances
crud_kb_chunk = CRUDKBChunk()
crud_kb_job = CRUDKBJob()
crud_kb_settings = CRUDKBSettings()
crud_kb_audit = CRUDKBAudit()
