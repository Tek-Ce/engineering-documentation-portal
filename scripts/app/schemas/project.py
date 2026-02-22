# ============================================
# FILE: app/schemas/project.py
# ============================================
"""
Project Schemas - COMPLETE FIXED VERSION
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from enum import Enum


# Project Status Enum
class ProjectStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    COMPLETED = "completed"


# Base Project Schema
class ProjectBase(BaseModel):
    """Base project schema"""
    name: str = Field(..., min_length=1, max_length=200, description="Project name")
    description: Optional[str] = Field(None, description="Project description")
    brief: Optional[str] = Field(None, max_length=500, description="Brief summary")


# Project Create Schema
class ProjectCreate(ProjectBase):
    """Schema for creating a project"""
    code: str = Field(..., min_length=2, max_length=20, description="Unique project code")
    is_active: bool = Field(default=True, description="Is project active")
    member_ids: Optional[List[str]] = Field(default_factory=list, description="Initial member IDs")
    member_roles: Optional[dict[str, str]] = Field(default_factory=dict, description="Member role mapping")


# Project Update Schema
class ProjectUpdate(BaseModel):
    """Schema for updating a project"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    brief: Optional[str] = Field(None, max_length=500)
    code: Optional[str] = Field(None, min_length=2, max_length=20)
    status: Optional[ProjectStatus] = None
    is_active: Optional[bool] = None


# Simple member info for project cards
class ProjectMemberBrief(BaseModel):
    """Brief member info for project cards"""
    id: str
    user_id: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: str = "VIEWER"


# Project Response Schema
class ProjectResponse(ProjectBase):
    """Schema for project response"""
    id: str
    code: str
    status: str = Field(default="active")
    is_active: bool = Field(default=True)
    created_by: str
    created_at: datetime
    updated_at: datetime
    member_count: Optional[int] = Field(default=0)
    document_count: Optional[int] = Field(default=0)
    members: Optional[List[ProjectMemberBrief]] = Field(default=None, description="Project members (limited)")

    model_config = ConfigDict(from_attributes=True)


# Project Detail Response (with members)
class ProjectDetailResponse(ProjectResponse):
    """Detailed project response with members"""
    members: List["ProjectMemberResponse"] = Field(default_factory=list)
    creator_name: Optional[str] = None


# Project List Response
class ProjectListResponse(BaseModel):
    """Response for listing projects"""
    projects: List[ProjectResponse]
    total: int
    skip: int
    limit: int


# Project Statistics Response
class ProjectStatsResponse(BaseModel):
    """Project statistics"""
    total_documents: int = 0
    published_documents: int = 0
    draft_documents: int = 0
    total_comments: Optional[int] = 0
    total_members: Optional[int] = 0


# Import to avoid circular dependency
from app.schemas.project_member import ProjectMemberResponse
ProjectDetailResponse.model_rebuild()