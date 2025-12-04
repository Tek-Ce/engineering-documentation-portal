# ============================================
# FILE: app/api/v1/documents.py (FIXED)
# ============================================
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pathlib import Path
import mimetypes

from app.db.database import get_db
from app.models.user import User
from app.models.project_member import ProjectMemberRole
from app.schemas.document import DocumentCreate, DocumentUpdate, DocumentResponse, DocumentStatus, DocumentType, DocumentVersionResponse
from app.crud.document import crud_document
from app.api.deps import get_current_user, check_project_access
from app.services.file_service import FileService
from app.services.notification_service import NotificationService
from app.services.activity_service import ActivityService
from app.utils.helpers import get_client_ip

router = APIRouter()


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    request: Request,  # Fixed: Request is required, not optional
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
        import uuid as uuid_lib
        tag_ids = [t.strip() for t in tags.split(',') if t.strip()]
        for tag_id in tag_ids:
            doc_tag = DocumentTag(
                id=str(uuid_lib.uuid4()),
                document_id=str(document.id),
                tag_id=tag_id
            )
            db.add(doc_tag)

    # Add reviewers if provided
    if reviewer_ids:
        from app.models.document import document_reviewers
        reviewer_id_list = [r.strip() for r in reviewer_ids.split(',') if r.strip()]
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

    # Re-fetch with eager loading for tags and reviewers
    document = await crud_document.get(db, id=document.id)
    return DocumentResponse.model_validate(document)


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

    return DocumentResponse.model_validate(document)


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
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all documents for a project"""
    # Check project access
    await check_project_access(project_id, current_user=current_user, db=db)

    # Get documents
    documents, total = await crud_document.get_project_documents(
        db,
        project_id=project_id,
        status=status,
        skip=skip,
        limit=limit
    )

    return [DocumentResponse.model_validate(doc) for doc in documents]


@router.post("/{document_id}/upload-new-version", response_model=DocumentResponse)
async def upload_new_version(
    request: Request,
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