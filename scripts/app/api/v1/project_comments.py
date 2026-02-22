# ============================================
# FILE: app/api/v1/project_comments.py
# ============================================
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
import uuid
import re

from app.db.database import get_db
from app.models.user import User
from app.models.comment import ProjectComment
from app.api.deps import get_current_active_user
from app.crud.project_comment import crud_project_comment
from app.schemas.comment import (
    ProjectCommentCreate,
    ProjectCommentUpdate,
    ProjectCommentResponse,
    ProjectCommentListResponse
)
from app.models.notification import Notification

router = APIRouter()


async def build_comment_response(comment: ProjectComment, db: AsyncSession) -> dict:
    """Helper function to build comment response with user info and replies"""
    # Get user name
    user_name = None
    if comment.user_id:
        from app.crud.user import crud_user
        user = await crud_user.get(db, id=comment.user_id)
        user_name = user.full_name if user else "Unknown User"

    # Get replies with user info
    replies_data = []
    if hasattr(comment, 'replies') and comment.replies:
        for reply in comment.replies:
            reply_user_name = None
            if reply.user_id:
                from app.crud.user import crud_user
                reply_user = await crud_user.get(db, id=reply.user_id)
                reply_user_name = reply_user.full_name if reply_user else "Unknown User"

            replies_data.append({
                "id": str(reply.id),
                "project_id": str(reply.project_id),
                "user_id": str(reply.user_id) if reply.user_id else None,
                "parent_comment_id": str(reply.parent_comment_id) if reply.parent_comment_id else None,
                "content": reply.content,
                "is_resolved": reply.is_resolved,
                "created_at": reply.created_at,
                "updated_at": reply.updated_at,
                "user_name": reply_user_name,
                "replies": []
            })

    return {
        "id": str(comment.id),
        "project_id": str(comment.project_id),
        "user_id": str(comment.user_id) if comment.user_id else None,
        "parent_comment_id": str(comment.parent_comment_id) if comment.parent_comment_id else None,
        "content": comment.content,
        "is_resolved": comment.is_resolved,
        "created_at": comment.created_at,
        "updated_at": comment.updated_at,
        "user_name": user_name,
        "replies": replies_data
    }


@router.get("", response_model=ProjectCommentListResponse)
async def list_project_comments(
    project_id: str = Query(..., description="Project ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    include_resolved: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    List all comments for a project (top-level only, replies are nested)
    """
    # Get comments
    comments = await crud_project_comment.get_by_project(
        db,
        project_id=project_id,
        skip=skip,
        limit=limit,
        include_resolved=include_resolved
    )

    # Build response with user info and replies
    comments_data = []
    for comment in comments:
        # Load replies
        comment_with_replies = await crud_project_comment.get_with_replies(db, comment_id=comment.id)
        if comment_with_replies:
            comment_dict = await build_comment_response(comment_with_replies, db)
            comments_data.append(ProjectCommentResponse(**comment_dict))

    # Get total count
    total = await crud_project_comment.count_by_project(
        db,
        project_id=project_id,
        include_resolved=include_resolved
    )

    return ProjectCommentListResponse(comments=comments_data, total=total)


@router.post("", response_model=ProjectCommentResponse, status_code=status.HTTP_201_CREATED)
async def create_project_comment(
    comment_in: ProjectCommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a new project comment with smart notifications:
    - @mentions → notify specific mentioned users
    - Replies → notify original comment author
    - Other → no general notifications for comments
    """
    # Create comment
    comment = await crud_project_comment.create(
        db,
        obj_in=comment_in,
        user_id=current_user.id
    )
    await db.commit()
    await db.refresh(comment)

    from app.crud.user import crud_user
    from app.crud.project import crud_project
    from sqlalchemy import select

    # Get project info
    project = await crud_project.get(db, id=comment_in.project_id)

    notified_user_ids = set()  # Track who we've already notified

    # 1. HANDLE REPLIES - Notify original comment author
    if comment_in.parent_comment_id:
        parent_comment = await crud_project_comment.get(db, id=comment_in.parent_comment_id)
        if parent_comment and parent_comment.user_id and parent_comment.user_id != current_user.id:
            notification = Notification(
                id=str(uuid.uuid4()),
                user_id=parent_comment.user_id,
                project_id=comment_in.project_id,
                type="COMMENT_REPLY",
                message=f"{current_user.full_name} replied to your comment on {project.name if project else 'a project'}"
            )
            db.add(notification)
            notified_user_ids.add(parent_comment.user_id)

    # 2. HANDLE @MENTIONS - Notify specific mentioned users
    # Pattern matches @username (username part before @ in email)
    mention_pattern = r'@([a-zA-Z0-9._-]+)'
    mentions = re.findall(mention_pattern, comment.content)

    if mentions:
        # Get all users from the database
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
                mentioned_user.id != current_user.id and
                mentioned_user.id not in notified_user_ids):

                notification = Notification(
                    id=str(uuid.uuid4()),
                    user_id=mentioned_user.id,
                    project_id=comment_in.project_id,
                    type="MENTION",
                    message=f"{current_user.full_name} mentioned you in a comment on {project.name if project else 'a project'}"
                )
                db.add(notification)
                notified_user_ids.add(mentioned_user.id)

    await db.commit()

    # Build response with proper field initialization
    comment_dict = await build_comment_response(comment, db)
    return ProjectCommentResponse(**comment_dict)


@router.get("/{comment_id}", response_model=ProjectCommentResponse)
async def get_project_comment(
    comment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get a specific project comment with its replies
    """
    comment = await crud_project_comment.get_with_replies(db, comment_id=comment_id)
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )

    comment_dict = await build_comment_response(comment, db)
    return ProjectCommentResponse(**comment_dict)


@router.patch("/{comment_id}", response_model=ProjectCommentResponse)
async def update_project_comment(
    comment_id: str,
    comment_update: ProjectCommentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update a project comment (content or resolved status)
    """
    comment = await crud_project_comment.get(db, id=comment_id)
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )

    # Only comment owner or admin can update
    if comment.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this comment"
        )

    updated_comment = await crud_project_comment.update(
        db,
        db_obj=comment,
        obj_in=comment_update
    )
    await db.commit()
    await db.refresh(updated_comment)

    comment_dict = await build_comment_response(updated_comment, db)
    return ProjectCommentResponse(**comment_dict)


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_comment(
    comment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete a project comment
    """
    comment = await crud_project_comment.get(db, id=comment_id)
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )

    # Only comment owner or admin can delete
    if comment.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this comment"
        )

    await crud_project_comment.delete(db, id=comment_id)
    await db.commit()
