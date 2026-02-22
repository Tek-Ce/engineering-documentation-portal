# ============================================
# FILE: app/api/v1/kb.py
# Knowledge Base API Endpoints
# ============================================
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.database import get_db
from app.models.user import User
from app.models.document import Document
from app.models.project import Project
from app.models.kb import KBChunk, KBProcessingJob, KBSettings
from app.schemas.kb import (
    SearchRequest,
    SearchResponse,
    JobResponse,
    JobListResponse,
    DocumentIndexStatus,
    ProjectIndexStatus,
    IndexStatsResponse,
    KBSettingsUpdate,
    KBSettingsResponse,
    BulkIndexRequest,
    BulkIndexResponse,
    AIChatRequest,
    AIChatResponse
)
from app.crud.kb import crud_kb_chunk, crud_kb_job, crud_kb_settings, crud_kb_audit
from app.services.search_service import SearchService
from app.services.indexer_service import IndexerService, CrawlerService
from app.api.deps import get_current_user, get_current_active_user, check_project_access

router = APIRouter()


# ============================================
# Search Endpoints
# ============================================

@router.get("/search", response_model=SearchResponse)
async def kb_search(
    q: str = Query(..., min_length=1, max_length=1000, description="Search query"),
    project_id: Optional[str] = Query(None, description="Filter by project"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    use_semantic: bool = Query(True, description="Enable semantic search"),
    use_keyword: bool = Query(True, description="Enable keyword search"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Search the Knowledge Base.
    
    Performs hybrid search combining keyword matching and semantic similarity.
    """
    await crud_kb_audit.log(
        db,
        user_id=str(current_user.id),
        project_id=project_id,
        action="search",
        query=q
    )
    
    results = await SearchService.search(
        db,
        query=q,
        project_id=project_id,
        limit=limit,
        offset=offset,
        use_semantic=use_semantic,
        use_keyword=use_keyword
    )
    
    await db.commit()
    
    return SearchResponse(**results)


@router.post("/search", response_model=SearchResponse)
async def kb_search_advanced(
    request: SearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Advanced search with full options."""
    await crud_kb_audit.log(
        db,
        user_id=str(current_user.id),
        project_id=request.project_id,
        action="search_advanced",
        query=request.query
    )

    results = await SearchService.search(
        db,
        query=request.query,
        project_id=request.project_id,
        document_types=request.document_types,
        limit=request.limit,
        offset=request.offset,
        use_semantic=request.use_semantic,
        use_keyword=request.use_keyword,
        date_from=request.date_from,
        date_to=request.date_to
    )

    await db.commit()

    return SearchResponse(**results)


# ============================================
# AI Chat Endpoint
# ============================================

@router.post("/chat", response_model=AIChatResponse)
async def kb_chat(
    request: AIChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    AI-powered chat for explaining and discussing document content.

    The AI assistant can help users understand documentation by:
    - Summarizing content
    - Explaining concepts
    - Answering questions about the document
    - Providing examples and use cases
    """
    from app.services.ai_chat_service import chat_with_context

    # Log the chat request
    await crud_kb_audit.log(
        db,
        user_id=str(current_user.id),
        project_id=None,  # Could be extracted from document if needed
        action="ai_chat",
        query=request.message[:100]  # Truncate for logging
    )
    await db.commit()

    # Convert history to list of dicts if provided
    history_dicts = None
    if request.history:
        history_dicts = [
            {"role": msg.role, "content": msg.content}
            for msg in request.history
        ]

    # Generate AI response
    response_text = await chat_with_context(
        message=request.message,
        document_title=request.document_title,
        document_id=request.document_id,
        project_name=request.project_name,
        chunk_text=request.chunk_text,
        file_name=request.file_name,
        search_query=request.search_query,
        history=history_dicts
    )

    # Check if OpenAI was used (read at runtime)
    import os
    used_ai = bool(os.getenv("OPENAI_API_KEY"))
    print(f"[AI Chat] OpenAI key configured: {used_ai}")

    return AIChatResponse(
        response=response_text,
        used_ai=used_ai,
        context_used=bool(request.chunk_text or request.document_title)
    )


# ============================================
# Indexing Endpoints
# ============================================

@router.post("/index/document/{document_id}", response_model=JobResponse)
async def index_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Queue a document for indexing."""
    stmt = select(Document).where(Document.id == document_id)
    result = await db.execute(stmt)
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    
    await check_project_access(str(document.project_id), current_user=current_user, db=db)
    
    job = await crud_kb_job.create(
        db,
        document_id=document_id,
        project_id=str(document.project_id),
        job_type="index_document"
    )
    
    await db.commit()
    await db.refresh(job)
    
    background_tasks.add_task(_process_indexing_job, job_id=str(job.id), document_id=document_id)
    
    return JobResponse.model_validate(job)


@router.post("/index/project/{project_id}", response_model=BulkIndexResponse)
async def index_project(
    project_id: str,
    force_reindex: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Queue all documents in a project for indexing."""
    await check_project_access(project_id, current_user=current_user, db=db)
    
    stmt = select(Document).where(Document.project_id == project_id)
    result = await db.execute(stmt)
    documents = result.scalars().all()
    
    queued_count = 0
    skipped_count = 0
    job_ids = []
    
    for doc in documents:
        if not force_reindex:
            status_info = await IndexerService.get_document_index_status(db, str(doc.id))
            if status_info["is_indexed"]:
                skipped_count += 1
                continue
        
        job = await crud_kb_job.create(db, document_id=str(doc.id), project_id=project_id, job_type="index_document")
        job_ids.append(str(job.id))
        queued_count += 1
    
    await db.commit()
    
    return BulkIndexResponse(queued_count=queued_count, skipped_count=skipped_count, job_ids=job_ids)


@router.delete("/index/document/{document_id}")
async def delete_document_index(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete all indexed data for a document."""
    stmt = select(Document).where(Document.id == document_id)
    result = await db.execute(stmt)
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    
    await check_project_access(str(document.project_id), current_user=current_user, db=db)
    
    deleted_count = await crud_kb_chunk.delete_by_document(db, document_id)
    await db.commit()
    
    return {"message": f"Deleted {deleted_count} chunks", "document_id": document_id, "chunks_deleted": deleted_count}


# ============================================
# Status Endpoints
# ============================================

@router.get("/status/document/{document_id}", response_model=DocumentIndexStatus)
async def get_document_index_status(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get indexing status for a document."""
    stmt = select(Document).where(Document.id == document_id)
    result = await db.execute(stmt)
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    
    await check_project_access(str(document.project_id), current_user=current_user, db=db)
    
    status_info = await IndexerService.get_document_index_status(db, document_id)
    
    return DocumentIndexStatus(
        document_id=document_id,
        document_title=document.title,
        is_indexed=status_info["is_indexed"],
        chunk_count=status_info["chunk_count"],
        last_indexed=status_info["last_indexed"],
        index_status=status_info["latest_job_status"]
    )


@router.get("/status/project/{project_id}", response_model=ProjectIndexStatus)
async def get_project_index_status(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get indexing status for a project."""
    await check_project_access(project_id, current_user=current_user, db=db)
    
    proj_stmt = select(Project).where(Project.id == project_id)
    proj_result = await db.execute(proj_stmt)
    project = proj_result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    doc_count = await db.execute(select(func.count(Document.id)).where(Document.project_id == project_id))
    indexed = await db.execute(select(func.count(func.distinct(KBChunk.document_id))).where(KBChunk.project_id == project_id))
    chunks = await db.execute(select(func.count(KBChunk.id)).where(KBChunk.project_id == project_id))
    pending = await db.execute(select(func.count(KBProcessingJob.id)).where(
        KBProcessingJob.project_id == project_id,
        KBProcessingJob.status.in_(["queued", "processing"])
    ))
    
    return ProjectIndexStatus(
        project_id=project_id,
        project_name=project.name,
        total_documents=doc_count.scalar() or 0,
        indexed_documents=indexed.scalar() or 0,
        total_chunks=chunks.scalar() or 0,
        pending_jobs=pending.scalar() or 0
    )


@router.get("/stats", response_model=IndexStatsResponse)
async def get_index_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get overall Knowledge Base statistics."""
    project_count = await db.execute(select(func.count(Project.id)))
    doc_count = await db.execute(select(func.count(Document.id)))
    chunk_count = await db.execute(select(func.count(KBChunk.id)))
    token_count = await db.execute(select(func.coalesce(func.sum(KBChunk.token_count), 0)))
    pending_count = await db.execute(select(func.count(KBProcessingJob.id)).where(KBProcessingJob.status == "queued"))
    failed_count = await db.execute(select(func.count(KBProcessingJob.id)).where(KBProcessingJob.status == "failed"))
    
    project_stats = []
    projects_result = await db.execute(select(Project).limit(50))
    
    for proj in projects_result.scalars().all():
        proj_doc = await db.execute(select(func.count(Document.id)).where(Document.project_id == proj.id))
        proj_indexed = await db.execute(select(func.count(func.distinct(KBChunk.document_id))).where(KBChunk.project_id == proj.id))
        proj_chunks = await db.execute(select(func.count(KBChunk.id)).where(KBChunk.project_id == proj.id))
        proj_pending = await db.execute(select(func.count(KBProcessingJob.id)).where(
            KBProcessingJob.project_id == proj.id,
            KBProcessingJob.status.in_(["queued", "processing"])
        ))
        
        project_stats.append(ProjectIndexStatus(
            project_id=str(proj.id),
            project_name=proj.name,
            total_documents=proj_doc.scalar() or 0,
            indexed_documents=proj_indexed.scalar() or 0,
            total_chunks=proj_chunks.scalar() or 0,
            pending_jobs=proj_pending.scalar() or 0
        ))
    
    return IndexStatsResponse(
        total_projects=project_count.scalar() or 0,
        total_documents=doc_count.scalar() or 0,
        total_chunks=chunk_count.scalar() or 0,
        total_tokens=token_count.scalar() or 0,
        pending_jobs=pending_count.scalar() or 0,
        failed_jobs=failed_count.scalar() or 0,
        projects=project_stats
    )


# ============================================
# Job Management Endpoints
# ============================================

@router.get("/jobs", response_model=JobListResponse)
async def list_jobs(
    project_id: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List processing jobs."""
    stmt = select(KBProcessingJob)
    
    if project_id:
        await check_project_access(project_id, current_user=current_user, db=db)
        stmt = stmt.where(KBProcessingJob.project_id == project_id)
    
    if status_filter:
        stmt = stmt.where(KBProcessingJob.status == status_filter)
    
    count_stmt = select(func.count(KBProcessingJob.id))
    if project_id:
        count_stmt = count_stmt.where(KBProcessingJob.project_id == project_id)
    if status_filter:
        count_stmt = count_stmt.where(KBProcessingJob.status == status_filter)
    
    total = (await db.execute(count_stmt)).scalar() or 0
    
    stmt = stmt.order_by(KBProcessingJob.created_at.desc()).offset(skip).limit(limit)
    jobs = (await db.execute(stmt)).scalars().all()
    
    return JobListResponse(jobs=[JobResponse.model_validate(j) for j in jobs], total=total)


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a specific job."""
    job = await crud_kb_job.get(db, job_id)
    
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    
    await check_project_access(str(job.project_id), current_user=current_user, db=db)
    
    return JobResponse.model_validate(job)


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Cancel a pending job."""
    job = await crud_kb_job.get(db, job_id)
    
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    
    await check_project_access(str(job.project_id), current_user=current_user, db=db)
    
    if job.status not in ["queued"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot cancel job with status: {job.status}")
    
    await crud_kb_job.update_status(db, job_id, "cancelled")
    await db.commit()
    
    return {"message": "Job cancelled", "job_id": job_id}


# ============================================
# Settings Endpoints
# ============================================

@router.get("/settings/{project_id}", response_model=KBSettingsResponse)
async def get_kb_settings(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get KB settings for a project."""
    await check_project_access(project_id, current_user=current_user, db=db)
    settings = await crud_kb_settings.get_or_create(db, project_id)
    await db.commit()
    return KBSettingsResponse.model_validate(settings)


@router.put("/settings/{project_id}", response_model=KBSettingsResponse)
async def update_kb_settings(
    project_id: str,
    settings_update: KBSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update KB settings for a project."""
    await check_project_access(project_id, current_user=current_user, db=db)
    update_data = settings_update.model_dump(exclude_unset=True)
    settings = await crud_kb_settings.update(db, project_id, **update_data)
    await db.commit()
    await db.refresh(settings)
    return KBSettingsResponse.model_validate(settings)


# ============================================
# Admin Endpoints
# ============================================

@router.post("/crawler/scan")
async def trigger_crawler_scan(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Trigger a crawler scan to find documents needing indexing."""
    result = await CrawlerService.scan_for_new_documents(db)
    await db.commit()

    return {"message": "Crawler scan completed", **result}


@router.post("/crawler/process")
async def process_pending_jobs(
    max_jobs: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Process pending indexing jobs."""
    result = await CrawlerService.process_pending_jobs(db, max_jobs=max_jobs)
    await db.commit()

    return {"message": "Job processing completed", **result}


@router.post("/index-all")
async def index_all_documents(
    force_reindex: bool = Query(False, description="Force re-index even if already indexed"),
    current_user: User = Depends(get_current_active_user)
):
    """
    Synchronously index all documents in the system.

    This endpoint processes documents immediately (not via background jobs).
    Useful for initial setup or after adding many documents.

    Warning: This may take a while for large document sets.
    """
    from app.db.database import AsyncSessionLocal

    # Check if user is admin (optional, can be removed if all users should be able to trigger)
    if current_user.role != "admin" and current_user.created_by is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can trigger full index"
        )

    # First, get all document IDs and titles (collect upfront to avoid session issues)
    doc_info_list = []
    async with AsyncSessionLocal() as db:
        stmt = select(Document.id, Document.title)
        result = await db.execute(stmt)
        for row in result.fetchall():
            doc_info_list.append({"id": str(row[0]), "title": row[1]})

    results = {
        "total_documents": len(doc_info_list),
        "indexed": 0,
        "skipped": 0,
        "failed": 0,
        "total_chunks": 0,
        "errors": []
    }

    # Process each document in its own session to avoid session state issues
    for doc_info in doc_info_list:
        doc_id = doc_info["id"]
        doc_title = doc_info["title"]

        try:
            async with AsyncSessionLocal() as db:
                # Check if already indexed (unless force reindex)
                if not force_reindex:
                    status_info = await IndexerService.get_document_index_status(db, doc_id)
                    if status_info["is_indexed"]:
                        results["skipped"] += 1
                        continue

                # Fetch fresh document for indexing
                doc_stmt = select(Document).where(Document.id == doc_id)
                doc_result = await db.execute(doc_stmt)
                document = doc_result.scalar_one_or_none()

                if not document:
                    results["failed"] += 1
                    results["errors"].append({
                        "document_id": doc_id,
                        "title": doc_title,
                        "error": "Document not found"
                    })
                    continue

                # Index the document
                index_result = await IndexerService.index_document(
                    db=db,
                    document=document,
                    force_reindex=force_reindex
                )

                if index_result.get("success"):
                    chunks = index_result.get("chunks_created", 0)
                    if chunks > 0:
                        results["indexed"] += 1
                        results["total_chunks"] += chunks
                        await db.commit()
                    else:
                        results["skipped"] += 1
                else:
                    results["failed"] += 1
                    results["errors"].append({
                        "document_id": doc_id,
                        "title": doc_title,
                        "error": index_result.get("error", "Unknown error")
                    })

        except Exception as e:
            results["failed"] += 1
            results["errors"].append({
                "document_id": doc_id,
                "title": doc_title,
                "error": str(e)
            })

    return {
        "message": "Indexing completed",
        **results
    }


# ============================================
# Helper Functions
# ============================================

async def _process_indexing_job(job_id: str, document_id: str):
    """Background task to process an indexing job."""
    from app.db.database import AsyncSessionLocal
    
    async with AsyncSessionLocal() as db:
        try:
            stmt = select(Document).where(Document.id == document_id)
            result = await db.execute(stmt)
            document = result.scalar_one_or_none()
            
            if not document:
                await crud_kb_job.update_status(db, job_id, "failed", "Document not found")
                await db.commit()
                return
            
            await IndexerService.index_document(db, document, job_id=job_id)
            await db.commit()
            
        except Exception as e:
            await crud_kb_job.update_status(db, job_id, "failed", str(e))
            await db.commit()
