"""
Knowledge Base API Endpoints (MVP)
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.db.database import get_db
from app.models.user import User, UserRole
from app.api.deps import get_current_user, require_role
from app.services.kb import (
    get_indexer,
    get_retriever,
    get_summarizer,
)
from app.crud import document as crud_document

router = APIRouter()


# Pydantic Schemas
class IndexDocumentRequest(BaseModel):
    document_id: str = Field(..., description="UUID of document to index")

class IndexDocumentResponse(BaseModel):
    job_id: str
    status: str
    message: str

class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500, description="Search query")
    project_id: Optional[str] = Field(None, description="UUID of project to search within (None = all projects)")
    top_k: int = Field(10, ge=1, le=50, description="Number of results")
    min_similarity: float = Field(0.3, ge=0.0, le=1.0, description="Minimum similarity score")
    document_id: Optional[str] = Field(None, description="Optional document filter")
    use_hybrid: bool = Field(True, description="Use hybrid search (vector + keyword)")

class SearchResultItem(BaseModel):
    chunk_id: str
    chunk_text: str
    document_id: Optional[str]
    project_id: str
    similarity_score: float
    metadata: dict
    keywords: List[str] = []

class SearchResponse(BaseModel):
    results: List[SearchResultItem]
    query: str
    result_count: int

class SummarizeRequest(BaseModel):
    document_id: Optional[str] = Field(None, description="Document to summarize")
    project_id: Optional[str] = Field(None, description="Project to summarize")
    summary_type: str = Field("short", description="short, long, or executive")
    regenerate: bool = Field(False, description="Force regeneration")

class SummarizeResponse(BaseModel):
    summary: str
    key_points: List[str] = []
    method: str
    cached: bool = False

class JobStatusResponse(BaseModel):
    job_id: str
    job_type: str
    status: str
    attempts: int
    result: Optional[dict]
    created_at: Optional[str]
    updated_at: Optional[str]


# Endpoints
@router.post("/index", response_model=IndexDocumentResponse)
async def index_document(
    request: IndexDocumentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Index a document into the knowledge base

    This endpoint triggers document processing:
    1. Extract text from the document
    2. Split into chunks
    3. Generate embeddings
    4. Store in vector database
    """
    indexer = get_indexer()

    # Get document
    document = await crud_document.get(db, id=request.document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Check permissions (must be project member)
    # TODO: Add project membership check

    try:
        # Trigger indexing
        job_id = await indexer.index_document(
            db=db,
            document_id=request.document_id,
            project_id=document.project_id,
            file_path=document.file_path,
            source_type="document"
        )

        return IndexDocumentResponse(
            job_id=job_id,
            status="processing",
            message="Document indexing started"
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to index document: {str(e)}"
        )


@router.post("/search", response_model=SearchResponse)
async def search_knowledge_base(
    request: SearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search the knowledge base using semantic similarity

    Supports:
    - Vector similarity search
    - Hybrid search (vector + keyword)
    - Project and document filtering
    """
    retriever = get_retriever()

    # Check permissions
    # TODO: Add project membership check

    try:
        if request.use_hybrid:
            results = await retriever.hybrid_search(
                db=db,
                query=request.query,
                project_id=request.project_id,
                top_k=request.top_k,
                min_similarity=request.min_similarity,
                document_id=request.document_id
            )
        else:
            results = await retriever.search(
                db=db,
                query=request.query,
                project_id=request.project_id,
                top_k=request.top_k,
                min_similarity=request.min_similarity,
                document_id=request.document_id
            )

        # Convert to response
        result_items = [
            SearchResultItem(
                chunk_id=r.chunk_id,
                chunk_text=r.chunk_text,
                document_id=r.document_id,
                project_id=r.project_id,
                similarity_score=r.similarity_score,
                metadata=r.metadata,
                keywords=r.keywords
            )
            for r in results
        ]

        return SearchResponse(
            results=result_items,
            query=request.query,
            result_count=len(result_items)
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )


@router.post("/summarize", response_model=SummarizeResponse)
async def generate_summary(
    request: SummarizeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate summary for a document or project

    Uses rule-based extractive summarization (MVP - no LLM)
    """
    summarizer = get_summarizer()

    # Validate input
    if not request.document_id and not request.project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either document_id or project_id must be provided"
        )

    # Check permissions
    # TODO: Add project membership check

    try:
        if request.document_id:
            # Summarize document
            result = await summarizer.summarize_document(
                db=db,
                document_id=request.document_id,
                summary_type=request.summary_type
            )

            return SummarizeResponse(
                summary=result['summary'],
                key_points=result.get('key_points', []),
                method=result['method'],
                cached=False
            )
        else:
            # Summarize project
            result = await summarizer.summarize_project(
                db=db,
                project_id=request.project_id,
                regenerate=request.regenerate
            )

            summary_text = result['short'] if request.summary_type == 'short' else result['long']

            return SummarizeResponse(
                summary=summary_text,
                key_points=[],
                method=result['generation_mode'],
                cached=result.get('cached', False)
            )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Summarization failed: {str(e)}"
        )


@router.get("/status/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get status of an indexing job
    """
    indexer = get_indexer()

    job_status = await indexer.get_job_status(db, job_id)

    if not job_status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )

    return JobStatusResponse(**job_status)


@router.get("/health")
async def health_check():
    """
    Health check endpoint for KB service
    """
    try:
        # Check if embedding service can be initialized
        from app.services.kb import get_embedding_service
        embedder = get_embedding_service()
        embedding_dim = embedder.get_embedding_dim()

        return {
            'status': 'healthy',
            'embedding_service': 'ok',
            'embedding_dim': embedding_dim
        }
    except Exception as e:
        return {
            'status': 'unhealthy',
            'error': str(e)
        }
