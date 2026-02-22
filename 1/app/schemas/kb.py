# ============================================
# FILE: app/schemas/kb.py
# Knowledge Base Schemas - Pipeline Architecture
# ============================================
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ============================================
# Enums
# ============================================

class JobStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobType(str, Enum):
    INDEX_DOCUMENT = "index_document"
    REINDEX_PROJECT = "reindex_project"
    DELETE_INDEX = "delete_index"
    GENERATE_SUMMARY = "generate_summary"


class SourceType(str, Enum):
    DOCUMENT = "document"
    COMMENT = "comment"
    PROJECT = "project"


# ============================================
# Search Request/Response
# ============================================

class SearchRequest(BaseModel):
    """Advanced search request with all options"""
    query: str = Field(..., min_length=1, max_length=1000)
    project_id: Optional[str] = None
    document_types: Optional[List[str]] = None
    file_types: Optional[List[str]] = None
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
    
    # Search mode flags
    use_semantic: bool = True  # Vector similarity search
    use_keyword: bool = True   # FTS/keyword search
    
    # Filters
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    
    # Ranking options
    boost_recent: bool = True
    boost_title_match: bool = True


class SearchResultItem(BaseModel):
    """Single search result with ranking info"""
    chunk_id: str
    document_id: Optional[str] = None
    project_id: str
    
    # Content
    text: str
    highlight: str  # Highlighted snippet
    
    # Source info
    source_type: str
    file_name: Optional[str] = None
    file_path: Optional[str] = None
    document_title: Optional[str] = None
    project_name: Optional[str] = None
    
    # Scoring breakdown
    score: float  # Combined score
    keyword_score: Optional[float] = None
    semantic_score: Optional[float] = None
    
    # Context
    chunk_index: int
    total_chunks: Optional[int] = None
    created_at: datetime


class SearchResponse(BaseModel):
    """Search response with results and metadata"""
    query: str
    total_results: int
    results: List[SearchResultItem]
    
    # Performance metrics
    search_time_ms: int
    keyword_time_ms: Optional[int] = None
    semantic_time_ms: Optional[int] = None
    
    # Pagination
    limit: int
    offset: int
    has_more: bool
    
    # Search info
    used_semantic: bool = True
    used_keyword: bool = True


# ============================================
# Indexing Schemas
# ============================================

class IndexDocumentRequest(BaseModel):
    """Request to index a single document"""
    document_id: str
    force_reindex: bool = False
    priority: int = Field(default=5, ge=1, le=10)


class IndexProjectRequest(BaseModel):
    """Request to index all documents in a project"""
    project_id: str
    force_reindex: bool = False
    include_archived: bool = False


class BulkIndexRequest(BaseModel):
    """Request to index multiple documents"""
    document_ids: List[str]
    force_reindex: bool = False


class BulkIndexResponse(BaseModel):
    """Response for bulk index operation"""
    queued_count: int
    skipped_count: int
    already_indexed_count: int = 0
    job_ids: List[str]
    errors: List[Dict[str, str]] = []


# ============================================
# Job Management Schemas
# ============================================

class JobCreate(BaseModel):
    """Create a processing job"""
    document_id: str
    project_id: str
    job_type: JobType = JobType.INDEX_DOCUMENT
    priority: int = Field(default=5, ge=1, le=10)


class JobResponse(BaseModel):
    """Processing job details"""
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    document_id: str
    project_id: str
    status: str
    job_type: str
    progress: int
    total_chunks: Optional[int] = None
    processed_chunks: int
    error_message: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class JobListResponse(BaseModel):
    """List of jobs with pagination"""
    jobs: List[JobResponse]
    total: int
    pending: int = 0
    processing: int = 0
    completed: int = 0
    failed: int = 0


# ============================================
# Status & Stats Schemas
# ============================================

class DocumentIndexStatus(BaseModel):
    """Index status for a single document"""
    document_id: str
    document_title: str
    file_name: Optional[str] = None
    is_indexed: bool
    chunk_count: int
    token_count: int = 0
    last_indexed: Optional[datetime] = None
    content_hash: Optional[str] = None
    index_status: Optional[str] = None
    error: Optional[str] = None


class ProjectIndexStatus(BaseModel):
    """Index status for a project"""
    project_id: str
    project_name: str
    total_documents: int
    indexed_documents: int
    pending_documents: int = 0
    failed_documents: int = 0
    total_chunks: int
    total_tokens: int = 0
    pending_jobs: int
    last_indexed: Optional[datetime] = None


class IndexStatsResponse(BaseModel):
    """Overall KB statistics"""
    # Totals
    total_projects: int
    total_documents: int
    indexed_documents: int = 0
    total_chunks: int
    total_tokens: int
    
    # Jobs
    pending_jobs: int
    processing_jobs: int = 0
    completed_jobs: int = 0
    failed_jobs: int
    
    # Per-project breakdown
    projects: List[ProjectIndexStatus] = []


# ============================================
# Chunk Schemas
# ============================================

class ChunkResponse(BaseModel):
    """Single chunk details"""
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    document_id: Optional[str] = None
    project_id: str
    chunk_text: str
    chunk_index: int
    token_count: Optional[int] = None
    source_type: str
    created_at: datetime
    indexed_at: datetime
    has_embedding: bool = True


class ChunkListResponse(BaseModel):
    """List of chunks"""
    chunks: List[ChunkResponse]
    total: int


# ============================================
# Settings Schemas
# ============================================

class KBSettingsUpdate(BaseModel):
    """Update KB settings for a project"""
    allow_cloud_llm: Optional[bool] = None
    allow_web_search: Optional[bool] = None
    embedding_retention_days: Optional[int] = Field(None, ge=30, le=3650)
    summary_cache_days: Optional[int] = Field(None, ge=1, le=365)
    preferred_llm: Optional[str] = None
    max_llm_cost_per_month: Optional[float] = Field(None, ge=0, le=10000)
    who_can_chat: Optional[str] = None


class KBSettingsResponse(BaseModel):
    """KB settings for a project"""
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    project_id: str
    allow_cloud_llm: bool
    allow_web_search: bool
    embedding_retention_days: int
    summary_cache_days: int
    preferred_llm: str
    max_llm_cost_per_month: float
    who_can_chat: str
    created_at: datetime
    updated_at: datetime


# ============================================
# Crawler Schemas
# ============================================

class CrawlerStatus(BaseModel):
    """Crawler status and stats"""
    is_running: bool
    last_run: Optional[datetime] = None
    files_scanned: int = 0
    new_files_found: int = 0
    modified_files_found: int = 0
    jobs_queued: int = 0
    errors: List[str] = []


class CrawlerTriggerResponse(BaseModel):
    """Response from triggering crawler"""
    message: str
    scanned: int
    new_files: int = 0
    modified_files: int = 0
    jobs_queued: int
    duration_ms: int


# ============================================
# AI Chat Schemas
# ============================================

class ChatMessage(BaseModel):
    """Single chat message"""
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str


class AIChatRequest(BaseModel):
    """AI Chat request with context"""
    message: str = Field(..., min_length=1, max_length=2000)

    # Document context
    document_id: Optional[str] = None
    document_title: Optional[str] = None
    project_name: Optional[str] = None
    chunk_text: Optional[str] = None
    file_name: Optional[str] = None
    search_query: Optional[str] = None

    # Conversation history (last few messages for context)
    history: Optional[List[ChatMessage]] = None


class AIChatResponse(BaseModel):
    """AI Chat response"""
    response: str
    used_ai: bool = False  # True if actual AI API was used
    context_used: bool = True  # Whether document context was included
