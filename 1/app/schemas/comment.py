# ============================================
# FILE: app/schemas/comment.py
# ============================================
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime

class CommentBase(BaseModel):
    content: str = Field(..., min_length=1)

class CommentCreate(CommentBase):
    document_id: str
    parent_comment_id: Optional[str] = None
    

class CommentUpdate(BaseModel):
    content: Optional[str] = Field(None, min_length=1)
    is_resolved: Optional[bool] = None

class CommentResponse(CommentBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    document_id: str
    user_id: Optional[str] = None
    parent_comment_id: Optional[str] = None
    is_resolved: bool
    created_at: datetime
    updated_at: datetime
    
    
    user_name: Optional[str] = None
    replies: List["CommentResponse"] = Field(default_factory=list)

class CommentListResponse(BaseModel):
    comments: List[CommentResponse]
    total: int


# Project Comment Schemas
class ProjectCommentBase(BaseModel):
    content: str = Field(..., min_length=1)

class ProjectCommentCreate(ProjectCommentBase):
    project_id: str
    parent_comment_id: Optional[str] = None

class ProjectCommentUpdate(BaseModel):
    content: Optional[str] = Field(None, min_length=1)
    is_resolved: Optional[bool] = None

class ProjectCommentResponse(ProjectCommentBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    user_id: Optional[str] = None
    parent_comment_id: Optional[str] = None
    is_resolved: bool
    created_at: datetime
    updated_at: datetime

    user_name: Optional[str] = None
    replies: List["ProjectCommentResponse"] = Field(default_factory=list)

class ProjectCommentListResponse(BaseModel):
    comments: List[ProjectCommentResponse]
    total: int
