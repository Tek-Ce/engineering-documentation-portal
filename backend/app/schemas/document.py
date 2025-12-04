# ============================================
# FILE: app/schemas/document.py
# ============================================
from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, List, Any
from datetime import datetime, timezone
from enum import Enum

class DocumentStatus(str, Enum):
    DRAFT = "draft"
    REVIEW = "review"
    APPROVED = "approved"
    PUBLISHED = "published"
    ARCHIVED = "archived"

class DocumentType(str, Enum):
    GUIDE = "guide"
    CONFIG = "config"
    SOP = "sop"
    REPORT = "report"
    DIAGRAM = "diagram"
    OTHER = "other"

class DocumentBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None

class DocumentCreate(DocumentBase):
    project_id: str
    status: DocumentStatus = DocumentStatus.DRAFT

class DocumentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[DocumentStatus] = None
    document_type: Optional[DocumentType] = None
    tag_ids: Optional[List[str]] = None
    reviewer_ids: Optional[List[str]] = None

class DocumentVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    version_number: int
    file_path: str
    file_size: Optional[int] = None
    change_notes: Optional[str] = None
    created_at: datetime

class DocumentResponse(DocumentBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    file_path: str
    file_name: str
    file_size: Optional[int] = None
    file_type: Optional[str] = None
    mime_type: Optional[str] = None
    document_type: str
    status: str
    version: int
    uploaded_at: datetime
    updated_at: datetime

    project_name: Optional[str] = None
    uploader_name: Optional[str] = None
    tags: List[dict] = Field(default_factory=list)  # List of {id, name}
    reviewers: List[str] = Field(default_factory=list)

    @field_validator('tags', mode='before')
    @classmethod
    def transform_tags(cls, v: Any) -> List[dict]:
        """Transform DocumentTag relationship objects to {id, name} dicts"""
        if not v:
            return []
        # v is a list of DocumentTag objects with .tag relationship
        result = []
        for doc_tag in v:
            if hasattr(doc_tag, 'tag') and doc_tag.tag:
                result.append({
                    'id': doc_tag.tag.id,
                    'name': doc_tag.tag.name
                })
        return result

    @field_validator('reviewers', mode='before')
    @classmethod
    def transform_reviewers(cls, v: Any) -> List[str]:
        """Transform User objects to list of user IDs"""
        if not v:
            return []
        # v is a list of User objects
        return [str(user.id) for user in v if hasattr(user, 'id')]

class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]
    total: int
    page: int
    page_size: int
