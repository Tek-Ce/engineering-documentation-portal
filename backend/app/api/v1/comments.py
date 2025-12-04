# ============================================
# FILE: app/api/v1/comments.py - COMPLETE
# ============================================
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
import re

from app.db.database import get_db
from app.models.user import User
from app.schemas.comment import (
    CommentCreate,
    CommentUpdate,
    CommentResponse,
    CommentListResponse
)
from app.crud.comment import crud_comment
from app.crud.document import crud_document
from app.crud.user import crud_user
from app.services.notification_service import NotificationService
from app.api.deps import (
    get_current_user,
    get_current_active_user,
    check_project_access
)

router = APIRouter()


def extract_mentions(content: str) -> List[str]:
    """Extract @username mentions from comment content"""
    # Match @username or @email patterns
    mention_pattern = r'@([a-zA-Z0-9._-]+(?:@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})?)'
    mentions = re.findall(mention_pattern, content)
    return mentions


# ============================================
# Comment CRUD Operations
# ============================================

@router.get("/document/{document_id}", response_model=CommentListResponse)
async def list_document_comments(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get all comments for a document
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
    
    # Get comments
    comments = await crud_comment.get_document_comments(db, document_id=document_id)

    # Build responses with user details
    comment_responses = []
    for comment in comments:
        comment_dict = {
            "id": str(comment.id),
            "document_id": str(comment.document_id),
            "user_id": str(comment.user_id) if comment.user_id else None,
            "parent_comment_id": str(comment.parent_comment_id) if comment.parent_comment_id else None,
            "content": comment.content,
            "is_resolved": comment.is_resolved,
            "created_at": comment.created_at,
            "updated_at": comment.updated_at,
            "user_name": comment.user.full_name if comment.user else "Unknown User",
            "replies": []
        }
        comment_responses.append(CommentResponse(**comment_dict))

    return CommentListResponse(
        comments=comment_responses,
        total=len(comment_responses)
    )


@router.post("", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment(
    comment_in: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a new comment on a document
    """
    # Check if document exists
    document = await crud_document.get(db, id=comment_in.document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check project access
    project_id = str(document.project_id)
    await check_project_access(project_id, current_user=current_user, db=db)
    
    # If replying to a comment, verify parent exists
    if comment_in.parent_comment_id:
        parent = await crud_comment.get(db, id=comment_in.parent_comment_id)
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent comment not found"
            )
        
        # Verify parent belongs to same document
        if str(parent.document_id) != comment_in.document_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent comment is not on this document"
            )
    
    # Create comment
    comment = await crud_comment.create(
        db,
        obj_in=comment_in,
        user_id=str(current_user.id)
    )

    await db.commit()
    await db.refresh(comment)

    notified_user_ids = set()  # Track who we've already notified

    # 1. HANDLE REPLIES - Notify original comment author
    if comment_in.parent_comment_id:
        parent = await crud_comment.get(db, id=comment_in.parent_comment_id)
        if parent and parent.user_id and str(parent.user_id) != str(current_user.id):
            await NotificationService.create_notification(
                db=db,
                user_id=str(parent.user_id),
                message=f"{current_user.full_name} replied to your comment on {document.title}",
                notification_type="COMMENT_REPLY",
                project_id=str(document.project_id),
                document_id=str(document.id)
            )
            notified_user_ids.add(str(parent.user_id))

    # 2. HANDLE @MENTIONS - Parse mentions and create notifications
    mentions = extract_mentions(comment_in.content)
    if mentions:
        from sqlalchemy import select

        # Get all users
        result = await db.execute(select(User))
        all_users = result.scalars().all()

        for mention in mentions:
            # Find user whose email starts with this username
            mentioned_user = None
            for user in all_users:
                if user.email and user.email.split('@')[0].lower() == mention.lower():
                    mentioned_user = user
                    break

            # Only notify if user exists, not already notified, and not the commenter
            if (mentioned_user and
                str(mentioned_user.id) != str(current_user.id) and
                str(mentioned_user.id) not in notified_user_ids):

                await NotificationService.create_notification(
                    db=db,
                    user_id=str(mentioned_user.id),
                    message=f"{current_user.full_name} mentioned you in a comment on {document.title}",
                    notification_type="MENTION",
                    project_id=str(document.project_id),
                    document_id=str(document.id)
                )
                notified_user_ids.add(str(mentioned_user.id))

    await db.commit()

    # Build response with proper field initialization
    comment_dict = {
        "id": str(comment.id),
        "document_id": str(comment.document_id),
        "user_id": str(comment.user_id) if comment.user_id else None,
        "parent_comment_id": str(comment.parent_comment_id) if comment.parent_comment_id else None,
        "content": comment.content,
        "is_resolved": comment.is_resolved,
        "created_at": comment.created_at,
        "updated_at": comment.updated_at,
        "user_name": current_user.full_name,
        "replies": []
    }
    return CommentResponse(**comment_dict)


@router.get("/{comment_id}", response_model=CommentResponse)
async def get_comment(
    comment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get a specific comment
    """
    comment = await crud_comment.get(db, id=comment_id)
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )
    
    # Check if user has access to the document
    document = await crud_document.get(db, id=str(comment.document_id))
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    project_id = str(document.project_id)
    await check_project_access(project_id, current_user=current_user, db=db)
    
    return CommentResponse.model_validate(comment)


@router.put("/{comment_id}", response_model=CommentResponse)
async def update_comment(
    comment_id: str,
    comment_in: CommentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update a comment
    Only the comment author or admin can update
    """
    comment = await crud_comment.get(db, id=comment_id)
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )
    
    # Check if user is the author or admin
    user_role = str(getattr(current_user, 'role', ''))
    if str(comment.user_id) != str(current_user.id) and user_role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this comment"
        )
    
    # Update comment
    comment = await crud_comment.update(db, db_obj=comment, obj_in=comment_in)
    await db.commit()
    await db.refresh(comment)
    
    return CommentResponse.model_validate(comment)


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete a comment
    Only the comment author or admin can delete
    """
    comment = await crud_comment.get(db, id=comment_id)
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )
    
    # Check if user is the author or admin
    user_role = str(getattr(current_user, 'role', ''))
    if str(comment.user_id) != str(current_user.id) and user_role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this comment"
        )
    
    await crud_comment.delete(db, id=comment_id)
    await db.commit()


@router.post("/{comment_id}/resolve", response_model=CommentResponse)
async def resolve_comment(
    comment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Mark a comment as resolved
    """
    comment = await crud_comment.get(db, id=comment_id)
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )
    
    # Check access to document
    document = await crud_document.get(db, id=str(comment.document_id))
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    project_id = str(document.project_id)
    await check_project_access(project_id, current_user=current_user, db=db)
    
    # Resolve comment
    comment = await crud_comment.resolve(db, comment_id=comment_id)
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )
    
    await db.commit()
    await db.refresh(comment)
    
    return CommentResponse.model_validate(comment)


@router.post("/{comment_id}/unresolve", response_model=CommentResponse)
async def unresolve_comment(
    comment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Mark a comment as unresolved
    """
    comment = await crud_comment.get(db, id=comment_id)
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )
    
    # Check access to document
    document = await crud_document.get(db, id=str(comment.document_id))
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    project_id = str(document.project_id)
    await check_project_access(project_id, current_user=current_user, db=db)
    
    # Unresolve comment
    setattr(comment, "is_resolved", False)
    db.add(comment)
    await db.flush()
    await db.commit()
    await db.refresh(comment)
    
    return CommentResponse.model_validate(comment)


@router.get("/document/{document_id}/threads", response_model=CommentListResponse)
async def get_comment_threads(
    document_id: str,
    resolved: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get comment threads (top-level comments with their replies)
    
    Optional filter by resolved status
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
    
    # Get comments
    all_comments = await crud_comment.get_document_comments(db, document_id=document_id)
    
    # Filter by resolved status if specified
    if resolved is not None:
        comments = [
            c for c in all_comments 
            if getattr(c, 'is_resolved', False) == resolved
        ]
    else:
        comments = all_comments
    
    # Filter to only top-level comments (no parent)
    thread_comments = [c for c in comments if c.parent_comment_id is None]
    
    return CommentListResponse(
        comments=[CommentResponse.model_validate(c) for c in thread_comments],
        total=len(thread_comments)
    )