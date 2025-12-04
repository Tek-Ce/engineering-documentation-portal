#============================================
# FILE: app/schemas/project_member.py
# ============================================
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
from enum import Enum

class ProjectMemberRole(str, Enum):
    OWNER = "OWNER"
    EDITOR = "EDITOR"
    VIEWER = "VIEWER"

# Base schema
class ProjectMemberBase(BaseModel):
    role: ProjectMemberRole = Field(default=ProjectMemberRole.VIEWER)

# Schema for creating a project member
class ProjectMemberCreate(ProjectMemberBase):
    project_id: str = Field(..., description="Project ID")
    user_id: str = Field(..., description="User ID to add to project")

# Schema for updating a project member
class ProjectMemberUpdate(BaseModel):
    role: Optional[ProjectMemberRole] = None

# Response schema
class ProjectMemberResponse(ProjectMemberBase):
    id: str
    project_id: str
    user_id: str
    added_by: Optional[str] = None
    added_at: datetime
    user_name: Optional[str] = None
    user_email: Optional[str] = None

    model_config = {"from_attributes": True}

# Optional extended schema with project details
class ProjectMemberWithProject(ProjectMemberResponse):
    project_name: Optional[str] = None
    project_code: Optional[str] = None
    model_config = {"from_attributes": True}

# Optional extended schema with user details
class ProjectMemberWithUser(ProjectMemberResponse):
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    model_config = {"from_attributes": True}
