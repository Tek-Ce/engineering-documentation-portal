# ============================================
# FILE: app/api/v1/documents.py (FIXED)
# ============================================
from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request, Query, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pathlib import Path
import mimetypes

from app.db.database import get_db
from app.models.user import User
from app.models.project_member import ProjectMemberRole
from app.schemas.document import DocumentCreate, DocumentUpdate, DocumentResponse, DocumentStatus, DocumentType, DocumentVersionResponse
from app.crud.document import crud_document
from app.crud.activity_log import crud_activity_log
from app.api.deps import get_current_user, check_project_access
from app.services.file_service import FileService
from app.services.notification_service import NotificationService
from app.services.activity_service import ActivityService
from app.utils.helpers import get_client_ip
from app.crud.kb import crud_kb_job, crud_kb_chunk
from app.services.indexer_service import IndexerService

router = APIRouter()


class DocumentActivityItem(BaseModel):
    id: str
    user_name: Optional[str] = None
    action: str
    description: Optional[str] = None
    created_at: Optional[str] = None


class DocumentActivityListResponse(BaseModel):
    logs: List[DocumentActivityItem]


# Background task for document indexing
async def _index_document_background(document_id: str, document_title: str, force_reindex: bool = False):
    """
    Background task to index a document for KB search.
    Runs after the HTTP response is sent so uploads feel fast.
    """
    from app.db.database import AsyncSessionLocal
    from sqlalchemy import select
    from app.models.document import Document

    try:
        async with AsyncSessionLocal() as db:
            # Fetch fresh document
            stmt = select(Document).where(Document.id == document_id)
            result = await db.execute(stmt)
            document = result.scalar_one_or_none()

            if not document:
                print(f"[KB Background] Document {document_id} not found for indexing")
                return

            # Index the document
            indexing_result = await IndexerService.index_document(
                db=db,
                document=document,
                force_reindex=force_reindex
            )

            if indexing_result.get("success"):
                await db.commit()
                print(f"[KB Background] Indexed: {document_title} ({indexing_result.get('chunks_created', 0)} chunks)")
            else:
                print(f"[KB Background] Warning: {document_title} - {indexing_result.get('error', 'Unknown error')}")

    except Exception as e:
        print(f"[KB Background] Failed to index {document_title}: {e}")


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    request: Request,
    background_tasks: BackgroundTasks,
    project_id: str = Form(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    status_value: str = Form("draft"),
    document_type_value: str = Form("other"),
    tags: Optional[str] = Form(None),  # Comma-separated tag IDs
    reviewer_ids: Optional[str] = Form(None),  # Comma-separated user IDs
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload document to project with tags, type, and reviewers"""
    # Check project access - returns ProjectAccessInfo
    access_info = await check_project_access(project_id, current_user=current_user, db=db)

    # Check if user has upload permission (OWNER or EDITOR)
    if access_info.role not in [ProjectMemberRole.OWNER, ProjectMemberRole.EDITOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only project owners and editors can upload documents"
        )

    # Save file
    file_metadata = await FileService.save_file(file, subfolder="documents")

    # Convert string to DocumentStatus enum
    try:
        doc_status = DocumentStatus(status_value)
    except ValueError:
        doc_status = DocumentStatus.DRAFT

    # Convert string to DocumentType enum
    try:
        doc_type = DocumentType(document_type_value)
    except ValueError:
        doc_type = DocumentType.OTHER

    # Create document
    doc_in = DocumentCreate(
        project_id=project_id,
        title=title,
        description=description,
        status=doc_status
    )

    # Create document with version
    document = await crud_document.create_with_version(
        db,
        obj_in=doc_in,
        uploaded_by_id=str(current_user.id),
        file_name=str(file_metadata["filename"]),
        file_path=str(file_metadata["file_path"]),
        file_size=int(file_metadata["file_size"]),
        file_type=str(file_metadata.get("stored_filename", "")).split(".")[-1],
        mime_type=str(file_metadata["mime_type"]),
    )

    # Set document type
    document.document_type = doc_type  # type: ignore[assignment]
    db.add(document)
    await db.flush()

    # Add tags if provided
    if tags:
        from app.models.tag import DocumentTag
        tag_ids = [t.strip() for t in tags.split(',') if t.strip()]
        for tag_id in tag_ids:
            doc_tag = DocumentTag(
                document_id=str(document.id),
                tag_id=tag_id,
                tagged_by=str(current_user.id)
            )
            db.add(doc_tag)

    # Add reviewers: use provided list, or default to project creator
    from app.models.document import document_reviewers
    from app.models.project import Project
    reviewer_id_list = [r.strip() for r in (reviewer_ids or "").split(",") if r.strip()]
    if not reviewer_id_list:
        # Default to project creator as reviewer
        proj_stmt = select(Project).where(Project.id == project_id)
        proj_result = await db.execute(proj_stmt)
        project = proj_result.scalar_one_or_none()
        if project and getattr(project, "created_by", None):
            reviewer_id_list = [str(project.created_by)]
    for reviewer_id in reviewer_id_list:
        stmt = document_reviewers.insert().values(
            document_id=str(document.id),
            user_id=reviewer_id
        )
        await db.execute(stmt)

    await db.flush()
    await db.refresh(document)

    
    # Log activity
    ip = get_client_ip(request)
    await ActivityService.log_activity(
        db,
        user_id=str(current_user.id),  # Fixed: Cast to str
        action="DOCUMENT_UPLOADED",
        resource_type="document",
        resource_id=str(document.id),  # Fixed: Cast to str
        description=f"Uploaded document: {title}",
        project_id=project_id,
        ip_address=ip
    )
    
    # Notify project members
    await NotificationService.notify_project_members(
    db=db,
    project_id=project_id,
    message=f"{current_user.full_name} uploaded a new document: {title}",
    notification_type="DOCUMENT_UPLOAD",  # ✅ fixed
    document_id=str(document.id),
    exclude_user_id=str(current_user.id)
    )

    await db.commit()

    # Index document for KB search in background (fast upload, indexing happens after response)
    background_tasks.add_task(
        _index_document_background,
        document_id=str(document.id),
        document_title=document.title,
        force_reindex=False
    )

    # Re-fetch with eager loading for tags and reviewers
    document = await crud_document.get(db, id=document.id)
    return DocumentResponse.model_validate(document)


@router.get("/recently-viewed", response_model=List[DocumentResponse])
async def get_recently_viewed(
    limit: int = Query(10, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the current user's recently viewed documents"""
    from app.models.activity_log import ActivityLog
    from sqlalchemy import select, distinct

    # Get recent DOCUMENT_VIEWED activity for this user, most recent first
    stmt = (
        select(ActivityLog)
        .where(
            ActivityLog.user_id == str(current_user.id),
            ActivityLog.action == "DOCUMENT_VIEWED",
            ActivityLog.resource_type == "document"
        )
        .order_by(ActivityLog.created_at.desc())
        .limit(limit * 3)  # over-fetch to deduplicate
    )
    result = await db.execute(stmt)
    logs = result.scalars().all()

    # Deduplicate document IDs while preserving order
    seen_ids = []
    for log in logs:
        if log.resource_id and log.resource_id not in seen_ids:
            seen_ids.append(log.resource_id)
        if len(seen_ids) >= limit:
            break

    # Fetch document objects
    documents = []
    for doc_id in seen_ids:
        doc = await crud_document.get(db, id=doc_id)
        if doc:
            documents.append(doc)

    return [DocumentResponse.model_validate(d) for d in documents]


@router.get("/pending-review", response_model=List[DocumentResponse])
async def get_pending_review_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all documents currently in review status that the user needs to action"""
    from sqlalchemy import select
    from app.models.document import Document, document_reviewers as dr_table

    if current_user.role == "ADMIN":
        stmt = (
            select(Document)
            .where(Document.status == "review")
            .order_by(Document.updated_at.desc())
            .limit(20)
        )
    else:
        stmt = (
            select(Document)
            .join(dr_table, dr_table.c.document_id == Document.id)
            .where(
                Document.status == "review",
                dr_table.c.user_id == str(current_user.id)
            )
            .order_by(Document.updated_at.desc())
            .limit(20)
        )

    result = await db.execute(stmt)
    documents = result.scalars().unique().all()
    return [DocumentResponse.model_validate(d) for d in documents]


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single document by ID"""
    # Get the document
    document = await crud_document.get(db, id=document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Check project access
    await check_project_access(document.project_id, current_user=current_user, db=db)

    # Track view in activity log
    try:
        await ActivityService.log_activity(
            db,
            user_id=str(current_user.id),
            action="DOCUMENT_VIEWED",
            resource_type="document",
            resource_id=str(document.id),
            description=f"Viewed document: {document.title}",
            project_id=document.project_id,
        )
        await db.commit()
    except Exception:
        pass  # Non-critical — don't fail if tracking fails

    return DocumentResponse.model_validate(document)


@router.get("/{document_id}/activity", response_model=DocumentActivityListResponse)
async def get_document_activity(
    document_id: str,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get activity log for a document (view, submit review, approve, reject, etc.). Requires project access."""
    document = await crud_document.get(db, id=document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    await check_project_access(document.project_id, current_user=current_user, db=db)
    logs = await crud_activity_log.get_logs(
        db,
        skip=0,
        limit=limit,
        resource_type="document",
        resource_id=document_id,
    )
    return DocumentActivityListResponse(
        logs=[
            DocumentActivityItem(
                id=log["id"],
                user_name=log.get("user_name"),
                action=log["action"],
                description=log.get("description"),
                created_at=log.get("created_at"),
            )
            for log in logs
        ]
    )


@router.patch("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: str,
    update_data: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update document metadata (title, description, status, type, tags, reviewers)"""
    # Get the document
    document = await crud_document.get(db, id=document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Check project access
    await check_project_access(document.project_id, current_user=current_user, db=db)

    # Update basic fields
    update_dict = {}
    if update_data.title is not None:
        update_dict['title'] = update_data.title
    if update_data.description is not None:
        update_dict['description'] = update_data.description
    if update_data.status is not None:
        update_dict['status'] = update_data.status.value
    if update_data.document_type is not None:
        update_dict['document_type'] = update_data.document_type.value

    # Update document
    if update_dict:
        document = await crud_document.update(db, db_obj=document, obj_in=update_dict)

    # Update tags if provided
    if update_data.tag_ids is not None:
        await crud_document.update_document_tags(db, document_id=document_id, tag_ids=update_data.tag_ids)

    # Update reviewers if provided
    if update_data.reviewer_ids is not None:
        await crud_document.update_document_reviewers(db, document_id=document_id, reviewer_ids=update_data.reviewer_ids)

    await db.commit()
    await db.refresh(document)

    return DocumentResponse.model_validate(document)


@router.get("/project/{project_id}", response_model=List[DocumentResponse])
async def list_project_documents(
    project_id: str,
    status: Optional[str] = Query(None),
    document_type: Optional[str] = Query(None),
    uploaded_by: Optional[str] = Query(None, description="Filter by author user ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all documents for a project with optional filters (status, type, author)"""
    # Check project access
    await check_project_access(project_id, current_user=current_user, db=db)

    # Get documents with filters
    documents, total = await crud_document.get_project_documents(
        db,
        project_id=project_id,
        status=status,
        document_type=document_type,
        uploaded_by=uploaded_by,
        skip=skip,
        limit=limit
    )

    return [DocumentResponse.model_validate(doc) for doc in documents]


@router.post("/{document_id}/upload-new-version", response_model=DocumentResponse)
async def upload_new_version(
    request: Request,
    background_tasks: BackgroundTasks,
    document_id: str,
    file: UploadFile = File(...),
    change_notes: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload a new version of an existing document"""
    # Get the document
    document = await crud_document.get(db, id=document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Check project access
    access_info = await check_project_access(document.project_id, current_user=current_user, db=db)

    # Check if user has upload permission (OWNER or EDITOR)
    if access_info.role not in [ProjectMemberRole.OWNER, ProjectMemberRole.EDITOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only project owners and editors can upload new versions"
        )

    # Save new file
    file_metadata = await FileService.save_file(file, subfolder="documents")

    # Create new version
    await crud_document.create_new_version(
        db,
        document=document,
        file_path=str(file_metadata["file_path"]),
        file_size=int(file_metadata["file_size"]),
        uploaded_by_id=str(current_user.id),
        change_notes=change_notes,
        file_name=str(file_metadata.get("filename", ""))
    )

    # Log activity
    ip = get_client_ip(request)
    await ActivityService.log_activity(
        db,
        user_id=str(current_user.id),
        action="DOCUMENT_VERSION_UPLOADED",
        resource_type="document",
        resource_id=str(document.id),
        description=f"Uploaded version {document.version} of document: {document.title}",
        project_id=document.project_id,
        ip_address=ip
    )

    # Notify project members
    await NotificationService.notify_project_members(
        db=db,
        project_id=document.project_id,
        message=f"{current_user.full_name} uploaded version {document.version} of: {document.title}",
        notification_type="DOCUMENT_VERSION_UPLOAD",
        document_id=str(document.id),
        exclude_user_id=str(current_user.id)
    )

    await db.commit()
    await db.refresh(document)

    # Re-index document for KB search in background (new version = new content)
    background_tasks.add_task(
        _index_document_background,
        document_id=str(document.id),
        document_title=document.title,
        force_reindex=True  # Force re-index since content changed
    )

    return DocumentResponse.model_validate(document)


@router.get("/{document_id}/versions", response_model=List[DocumentVersionResponse])
async def get_document_versions(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all versions of a document"""
    # Get the document
    document = await crud_document.get(db, id=document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Check project access
    await check_project_access(document.project_id, current_user=current_user, db=db)

    # Get versions
    versions = await crud_document.get_versions(db, document_id=document_id)

    return [DocumentVersionResponse.model_validate(v) for v in versions]


@router.get("/{document_id}/download")
async def download_document(
    document_id: str,
    version: Optional[int] = Query(None, description="Specific version to download (default: latest)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download a document file (optionally specific version)"""
    # Get the document
    document = await crud_document.get(db, id=document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Check project access
    await check_project_access(document.project_id, current_user=current_user, db=db)

    # Get the appropriate version
    if version is not None:
        # Get specific version
        versions = await crud_document.get_versions(db, document_id=document_id)
        target_version = next((v for v in versions if v.version_number == version), None)
        if not target_version:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Version {version} not found"
            )
        file_path = target_version.file_path
        # Use document's file_name for download filename
        filename = document.file_name
    else:
        # Get latest version (use document's current file_path and file_name)
        file_path = document.file_path
        filename = document.file_name

    # Build full file path
    full_path = Path("uploads") / file_path

    if not full_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on server"
        )

    # Try to detect mime type
    guessed_type, _ = mimetypes.guess_type(str(full_path))
    media_type = guessed_type or 'application/octet-stream'

    # For previewable types, serve inline; otherwise default to attachment
    inline_preview = media_type.startswith('application/pdf') or media_type.startswith('image/') or media_type.startswith('text/')

    headers = {}
    if inline_preview:
        # Force inline disposition so browsers render in iframe
        headers['Content-Disposition'] = f'inline; filename="{filename}"'

    return FileResponse(
        path=str(full_path),
        filename=filename,
        media_type=media_type,
        headers=headers if headers else None
    )


@router.post("/{document_id}/submit-review", response_model=DocumentResponse)
async def submit_for_review(
    request: Request,
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submit a document for review — changes status to 'review' and notifies reviewers"""
    document = await crud_document.get(db, id=document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    await check_project_access(document.project_id, current_user=current_user, db=db)

    if document.status not in ("draft", "review"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot submit for review — current status is '{document.status}'"
        )

    document.status = DocumentStatus.REVIEW.value  # type: ignore
    db.add(document)

    await ActivityService.log_activity(
        db,
        user_id=str(current_user.id),
        action="DOCUMENT_SUBMITTED_FOR_REVIEW",
        resource_type="document",
        resource_id=str(document.id),
        description=f"Submitted '{document.title}' for review",
        project_id=document.project_id,
    )

    # Notify assigned reviewers
    reviewer_ids = [str(r.id) for r in document.reviewers]
    if reviewer_ids:
        await NotificationService.notify_multiple_users(
            db=db,
            user_ids=reviewer_ids,
            message=f"{current_user.full_name} submitted '{document.title}' for your review",
            notification_type="DOCUMENT_REVIEW_REQUESTED",
            project_id=document.project_id,
            document_id=str(document.id),
            exclude_user_id=str(current_user.id),
        )
    else:
        # Notify project owners if no reviewers assigned
        await NotificationService.notify_project_members(
            db=db,
            project_id=document.project_id,
            message=f"{current_user.full_name} submitted '{document.title}' for review",
            notification_type="DOCUMENT_REVIEW_REQUESTED",
            document_id=str(document.id),
            exclude_user_id=str(current_user.id),
        )

    await db.commit()
    await db.refresh(document)

    # Email reviewers (non-blocking)
    try:
        from app.services.email_service import EmailService
        for rev in document.reviewers:
            if str(rev.id) != str(current_user.id):
                await EmailService.send_review_requested(
                    to_email=str(rev.email),
                    to_name=str(rev.full_name),
                    document_title=document.title,
                    document_id=str(document.id),
                    requester_name=str(current_user.full_name),
                )
    except Exception as e:
        print(f"[Email] Review request email failed: {e}")

    return DocumentResponse.model_validate(document)


@router.post("/{document_id}/approve", response_model=DocumentResponse)
async def approve_document(
    request: Request,
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approve a document — only assigned reviewers or admins can approve"""
    document = await crud_document.get(db, id=document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    await check_project_access(document.project_id, current_user=current_user, db=db)

    # Only reviewers or admins can approve
    reviewer_ids = [str(r.id) for r in document.reviewers]
    is_admin = current_user.role == "ADMIN"
    is_reviewer = str(current_user.id) in reviewer_ids
    if not is_admin and not is_reviewer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only assigned reviewers or admins can approve this document"
        )

    if document.status != "review":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document must be in 'review' status to approve (current: '{document.status}')"
        )

    document.status = DocumentStatus.APPROVED.value  # type: ignore
    db.add(document)

    await ActivityService.log_activity(
        db,
        user_id=str(current_user.id),
        action="DOCUMENT_APPROVED",
        resource_type="document",
        resource_id=str(document.id),
        description=f"Approved document: {document.title}",
        project_id=document.project_id,
    )

    # Notify the uploader (in-app)
    if document.uploaded_by and document.uploaded_by != str(current_user.id):
        await NotificationService.notify_user(
            db=db,
            user_id=str(document.uploaded_by),
            message=f"{current_user.full_name} approved your document '{document.title}'",
            notification_type="DOCUMENT_APPROVED",
            project_id=document.project_id,
            document_id=str(document.id),
        )

    await db.commit()
    await db.refresh(document)

    # Email the uploader (non-blocking)
    try:
        from app.services.email_service import EmailService
        from sqlalchemy import select as sa_select
        from app.models.user import User as UserModel
        if document.uploaded_by:
            res = await db.execute(sa_select(UserModel).where(UserModel.id == document.uploaded_by))
            uploader = res.scalar_one_or_none()
            if uploader:
                await EmailService.send_document_approved(
                    to_email=str(uploader.email),
                    to_name=str(uploader.full_name),
                    document_title=document.title,
                    document_id=str(document.id),
                    reviewer_name=str(current_user.full_name),
                )
    except Exception as e:
        print(f"[Email] Approval email failed: {e}")

    return DocumentResponse.model_validate(document)


@router.post("/{document_id}/reject", response_model=DocumentResponse)
async def reject_document(
    request: Request,
    document_id: str,
    reason: Optional[str] = Query(None, description="Reason for rejection"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reject a document — sends it back to draft with a rejection reason"""
    document = await crud_document.get(db, id=document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    await check_project_access(document.project_id, current_user=current_user, db=db)

    reviewer_ids = [str(r.id) for r in document.reviewers]
    is_admin = current_user.role == "ADMIN"
    is_reviewer = str(current_user.id) in reviewer_ids
    if not is_admin and not is_reviewer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only assigned reviewers or admins can reject this document"
        )

    if document.status != "review":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document must be in 'review' status to reject (current: '{document.status}')"
        )

    document.status = DocumentStatus.DRAFT.value  # type: ignore
    db.add(document)

    rejection_msg = f"Rejected '{document.title}'" + (f": {reason}" if reason else "")
    await ActivityService.log_activity(
        db,
        user_id=str(current_user.id),
        action="DOCUMENT_REJECTED",
        resource_type="document",
        resource_id=str(document.id),
        description=rejection_msg,
        project_id=document.project_id,
    )

    # Notify the uploader
    if document.uploaded_by and document.uploaded_by != str(current_user.id):
        notif_msg = f"{current_user.full_name} rejected your document '{document.title}'"
        if reason:
            notif_msg += f" — Reason: {reason}"
        await NotificationService.notify_user(
            db=db,
            user_id=str(document.uploaded_by),
            message=notif_msg,
            notification_type="DOCUMENT_REJECTED",
            project_id=document.project_id,
            document_id=str(document.id),
        )

    await db.commit()
    await db.refresh(document)

    # Email the uploader (non-blocking)
    try:
        from app.services.email_service import EmailService
        from sqlalchemy import select as sa_select
        from app.models.user import User as UserModel
        if document.uploaded_by:
            res = await db.execute(sa_select(UserModel).where(UserModel.id == document.uploaded_by))
            uploader = res.scalar_one_or_none()
            if uploader:
                await EmailService.send_document_rejected(
                    to_email=str(uploader.email),
                    to_name=str(uploader.full_name),
                    document_title=document.title,
                    document_id=str(document.id),
                    reviewer_name=str(current_user.full_name),
                    reason=reason,
                )
    except Exception as e:
        print(f"[Email] Rejection email failed: {e}")

    return DocumentResponse.model_validate(document)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    request: Request,
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a document

    Allowed for:
    - Default admin account (created_by IS NULL)
    - The user who uploaded the document (document owner)

    Raises:
        403: User is not authorized to delete this document
        404: Document not found
    """
    # Get the document first
    document = await crud_document.get(db, id=document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Check project access
    await check_project_access(document.project_id, current_user=current_user, db=db)

    # Check if user is authorized to delete:
    # 1. Default admin (created_by IS NULL)
    # 2. Document owner (uploaded_by matches current user)
    is_default_admin = current_user.created_by is None
    is_document_owner = str(document.uploaded_by) == str(current_user.id)

    if not is_default_admin and not is_document_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the document owner or default admin can delete documents"
        )

    # Store document info for logging before deletion
    doc_title = document.title
    doc_project_id = document.project_id
    file_path = document.file_path

    # Delete KB chunks for this document before deleting the document
    try:
        deleted_chunks = await crud_kb_chunk.delete_by_document(db, document_id)
        if deleted_chunks > 0:
            print(f"Deleted {deleted_chunks} KB chunks for document {document_id}")
    except Exception as e:
        # Log but don't fail the deletion if KB cleanup fails
        print(f"Warning: Failed to delete KB chunks: {e}")

    # Delete document from database (cascade will handle versions, tags, etc.)
    await crud_document.remove(db, id=document_id)

    # Delete physical file (and all versions)
    try:
        # Delete current file
        if file_path:
            full_path = Path("uploads") / file_path
            if full_path.exists():
                full_path.unlink()

        # Delete version files
        from app.models.document import DocumentVersion
        from sqlalchemy import select

        versions_result = await db.execute(
            select(DocumentVersion).where(DocumentVersion.document_id == document_id)
        )
        versions = versions_result.scalars().all()

        for version in versions:
            if version.file_path:
                version_path = Path("uploads") / version.file_path
                if version_path.exists():
                    version_path.unlink()
    except Exception as e:
        # Log error but don't fail the deletion
        print(f"Warning: Failed to delete physical files: {e}")

    # Log activity
    ip = get_client_ip(request)
    await ActivityService.log_activity(
        db,
        user_id=str(current_user.id),
        action="DOCUMENT_DELETED",
        resource_type="document",
        resource_id=document_id,
        description=f"Deleted document: {doc_title}",
        project_id=doc_project_id,
        ip_address=ip
    )

    # Notify project members
    await NotificationService.notify_project_members(
        db=db,
        project_id=doc_project_id,
        message=f"{current_user.full_name} deleted document: {doc_title}",
        notification_type="DOCUMENT_DELETED",
        exclude_user_id=str(current_user.id)
    )

    await db.commit()

    return None  # 204 No Content