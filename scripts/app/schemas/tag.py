# ============================================
# FILE: app/schemas/tag.py - FIXED
# ============================================
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime


class TagBase(BaseModel):
    """Base tag schema"""
    name: str
    color: Optional[str] = "#3B82F6"


class TagCreate(TagBase):
    """Schema for creating a tag"""
    pass


class TagUpdate(BaseModel):
    """Schema for updating a tag"""
    name: Optional[str] = None
    color: Optional[str] = None


class TagResponse(TagBase):
    """Schema for tag response"""
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    created_at: datetime


class TagListResponse(BaseModel):
    """
    Schema for list of tags
    
    ← MISSING CLASS #1 - Added for API endpoints
    """
    tags: List[TagResponse]
    total: int


class DocumentTagCreate(BaseModel):
    """
    Schema for creating document-tag association
    
    ← MISSING CLASS #2 - Added for API endpoints
    """
    document_id: str
    tag_id: str


class DocumentTagResponse(BaseModel):
    """Schema for document-tag association response"""
    document_id: str
    tag_id: str
    tagged_by: Optional[str] = None
    tagged_at: Optional[datetime] = None  # Made optional for flexibility
    
    # Include the tag details in response
    tag: Optional[TagResponse] = None