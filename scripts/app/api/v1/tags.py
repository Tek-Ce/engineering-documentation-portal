# ============================================
# FILE: app/api/v1/tags.py - COMPLETE
# ============================================
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.user import User
from app.schemas.tag import (
    TagCreate,
    TagUpdate,
    TagResponse,
    TagListResponse,
    DocumentTagCreate,
    DocumentTagResponse
)
from app.crud.tag import crud_tag
from app.crud.document import crud_document
from app.api.deps import (
    get_current_user,
    get_current_active_user,
    check_project_access
)

router = APIRouter()


# ============================================
# Tag CRUD Operations
# ============================================

@router.get("", response_model=TagListResponse)
async def list_tags(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    List all tags
    
    Tags are global and can be used across all documents
    """
    tags, total = await crud_tag.get_multi(db, skip=skip, limit=limit)

    return TagListResponse(
        tags=[TagResponse.model_validate(t) for t in tags],
        total=total
    )


@router.post("", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    tag_in: TagCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a new tag
    
    Tags must have unique names
    """
    # Check if tag with same name exists
    existing = await crud_tag.get_by_name(db, name=tag_in.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tag with this name already exists"
        )
    
    # Create tag
    tag = await crud_tag.create(db, obj_in=tag_in)
    
    await db.commit()
    await db.refresh(tag)
    
    return TagResponse.model_validate(tag)


@router.get("/{tag_id}", response_model=TagResponse)
async def get_tag(
    tag_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get a specific tag
    """
    tag = await crud_tag.get(db, id=tag_id)
    
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )
    
    return TagResponse.model_validate(tag)


@router.get("/name/{tag_name}", response_model=TagResponse)
async def get_tag_by_name(
    tag_name: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get a tag by name
    """
    tag = await crud_tag.get_by_name(db, name=tag_name)
    
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )
    
    return TagResponse.model_validate(tag)


@router.put("/{tag_id}", response_model=TagResponse)
async def update_tag(
    tag_id: str,
    tag_in: TagUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update a tag
    
    Can update name and/or color
    """
    tag = await crud_tag.get(db, id=tag_id)
    
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )
    
    # If updating name, check it doesn't conflict
    if tag_in.name and tag_in.name != tag.name:
        existing = await crud_tag.get_by_name(db, name=tag_in.name)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tag with this name already exists"
            )
    
    # Update tag
    tag = await crud_tag.update(db, db_obj=tag, obj_in=tag_in)
    
    await db.commit()
    await db.refresh(tag)
    
    return TagResponse.model_validate(tag)


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete a tag
    
    Only admins can delete tags
    This will remove the tag from all documents
    """
    # Check if user is admin
    user_role = str(getattr(current_user, 'role', ''))
    if user_role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete tags"
        )
    
    tag = await crud_tag.get(db, id=tag_id)
    
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )
    
    await crud_tag.delete(db, id=tag_id)
    await db.commit()


# ============================================
# Document-Tag Association
# ============================================

@router.get("/document/{document_id}", response_model=TagListResponse)
async def get_document_tags(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get all tags for a document
    """
    # Check if document exists and user has access
    document = await crud_document.get(db, id=document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check project access
    project_id = str(document.project_id)
    await check_project_access(project_id, current_user=current_user, db=db)
    
    # Get tags
    tags = await crud_tag.get_document_tags(db, document_id=document_id)
    
    return TagListResponse(
        tags=[TagResponse.model_validate(t) for t in tags],
        total=len(tags)
    )


@router.post("/document/{document_id}/tag/{tag_id}", response_model=DocumentTagResponse)
async def add_tag_to_document(
    document_id: str,
    tag_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Add a tag to a document
    """
    # Check if document exists
    document = await crud_document.get(db, id=document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check project access
    project_id = str(document.project_id)
    await check_project_access(project_id, current_user=current_user, db=db)
    
    # Check if tag exists
    tag = await crud_tag.get(db, id=tag_id)
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )
    
    # Check if tag already added to document
    existing_tags = await crud_tag.get_document_tags(db, document_id=document_id)
    if any(str(t.id) == tag_id for t in existing_tags):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tag already added to this document"
        )
    
    # Add tag to document
    doc_tag = await crud_tag.add_tag_to_document(
        db,
        document_id=document_id,
        tag_id=tag_id,
        tagged_by_id=str(current_user.id)
    )
    
    await db.commit()
    
    return DocumentTagResponse(
        document_id=document_id,
        tag_id=tag_id,
        tagged_by=str(current_user.id),
        tag=TagResponse.model_validate(tag)
    )


@router.delete("/document/{document_id}/tag/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_tag_from_document(
    document_id: str,
    tag_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Remove a tag from a document
    """
    # Check if document exists
    document = await crud_document.get(db, id=document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check project access
    project_id = str(document.project_id)
    await check_project_access(project_id, current_user=current_user, db=db)
    
    # Remove tag from document
    success = await crud_tag.remove_tag_from_document(
        db,
        document_id=document_id,
        tag_id=tag_id
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found on this document"
        )
    
    await db.commit()


@router.post("/document/{document_id}/tags/bulk", response_model=TagListResponse)
async def add_multiple_tags_to_document(
    document_id: str,
    tag_ids: List[str],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Add multiple tags to a document at once
    """
    # Check if document exists
    document = await crud_document.get(db, id=document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check project access
    project_id = str(document.project_id)
    await check_project_access(project_id, current_user=current_user, db=db)
    
    # Get existing tags
    existing_tags = await crud_tag.get_document_tags(db, document_id=document_id)
    existing_tag_ids = {str(t.id) for t in existing_tags}
    
    # Add each new tag
    added_tags = []
    for tag_id in tag_ids:
        # Skip if already added
        if tag_id in existing_tag_ids:
            continue
        
        # Check if tag exists
        tag = await crud_tag.get(db, id=tag_id)
        if not tag:
            continue  # Skip invalid tags
        
        # Add tag
        await crud_tag.add_tag_to_document(
            db,
            document_id=document_id,
            tag_id=tag_id,
            tagged_by_id=str(current_user.id)
        )
        added_tags.append(tag)
    
    await db.commit()
    
    # Return all tags (existing + new)
    all_tags = await crud_tag.get_document_tags(db, document_id=document_id)
    
    return TagListResponse(
        tags=[TagResponse.model_validate(t) for t in all_tags],
        total=len(all_tags)
    )