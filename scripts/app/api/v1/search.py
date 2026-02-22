"""
Search API Endpoints
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.user import User
from app.schemas.project import ProjectResponse
from app.schemas.document import DocumentResponse
from app.crud.project import crud_project
from app.crud.document import crud_document
from app.api.deps import get_current_user
from pydantic import BaseModel

router = APIRouter()


class SearchResults(BaseModel):
    projects: List[ProjectResponse]
    documents: List[DocumentResponse]
    total_results: int


@router.get("", response_model=SearchResults)
async def global_search(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(10, ge=1, le=50, description="Max results per category"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Global search across projects and documents
    """
    # Search projects
    projects = await crud_project.search(db, query=q, skip=0, limit=limit)

    # Search documents
    documents = await crud_document.search(db, query=q, skip=0, limit=limit)

    # Convert to response models
    project_responses = [ProjectResponse.model_validate(p) for p in projects]
    document_responses = [DocumentResponse.model_validate(d) for d in documents]

    total = len(project_responses) + len(document_responses)

    return SearchResults(
        projects=project_responses,
        documents=document_responses,
        total_results=total
    )
