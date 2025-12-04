"""
Projects API Endpoints
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.user import User
from app.models.project import Project
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectListResponse,
    ProjectStatsResponse
)
from app.schemas.project_member import (
    ProjectMemberCreate,
    ProjectMemberResponse,
    ProjectMemberRole as ProjectRoleEnum
)
from app.crud.project import crud_project
from app.crud.project_member import crud_project_member
from app.api.deps import (
    get_current_user,
    get_current_active_user,
    check_project_access,
    check_project_owner
)

router = APIRouter()


# ============================================
# Project CRUD Operations
# ============================================

@router.get("", response_model=ProjectListResponse)
async def list_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    active_only: bool = Query(False),
    status: Optional[str] = Query(None, description="Filter by status: active, archived, completed, or all"),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    List all projects accessible to current user
    """
    # Admin can see all projects
    user_role = str(getattr(current_user, 'role', ''))
    from sqlalchemy import select, or_, func

    if user_role == "ADMIN":
        query = select(Project)

        # Apply search filter
        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                or_(
                    Project.name.ilike(search_pattern),
                    Project.code.ilike(search_pattern),
                    Project.description.ilike(search_pattern),
                    Project.brief.ilike(search_pattern)
                )
            )

        # Apply status filter
        if status and status != 'all':
            query = query.where(Project.status == status)
        elif active_only:
            query = query.where(Project.is_active == True)

        # Get total count with same filters
        count_query = select(func.count()).select_from(Project)
        if search:
            search_pattern = f"%{search}%"
            count_query = count_query.where(
                or_(
                    Project.name.ilike(search_pattern),
                    Project.code.ilike(search_pattern),
                    Project.description.ilike(search_pattern),
                    Project.brief.ilike(search_pattern)
                )
            )
        if status and status != 'all':
            count_query = count_query.where(Project.status == status)
        elif active_only:
            count_query = count_query.where(Project.is_active == True)

        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        query = query.order_by(Project.updated_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        projects = list(result.scalars().all())
    else:
        # Regular users see projects where they are members
        from app.models.project_member import ProjectMember

        query = select(Project).join(
            ProjectMember, ProjectMember.project_id == Project.id
        ).where(
            ProjectMember.user_id == str(current_user.id)
        ).distinct()

        # Apply search filter
        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                or_(
                    Project.name.ilike(search_pattern),
                    Project.code.ilike(search_pattern),
                    Project.description.ilike(search_pattern),
                    Project.brief.ilike(search_pattern)
                )
            )

        # Apply status filter
        if status and status != 'all':
            query = query.where(Project.status == status)
        elif active_only:
            query = query.where(Project.is_active == True)

        # Get total count for user's projects with same filters
        count_query = select(func.count(Project.id.distinct())).select_from(Project).join(
            ProjectMember, ProjectMember.project_id == Project.id
        ).where(
            ProjectMember.user_id == str(current_user.id)
        )
        if search:
            search_pattern = f"%{search}%"
            count_query = count_query.where(
                or_(
                    Project.name.ilike(search_pattern),
                    Project.code.ilike(search_pattern),
                    Project.description.ilike(search_pattern),
                    Project.brief.ilike(search_pattern)
                )
            )
        if status and status != 'all':
            count_query = count_query.where(Project.status == status)
        elif active_only:
            count_query = count_query.where(Project.is_active == True)

        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        query = query.order_by(Project.updated_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        projects = list(result.scalars().all())

    # Add document counts to each project
    from sqlalchemy import select, func
    from app.models.document import Document

    project_responses = []
    for project in projects:
        # Get document count for this project
        doc_count_query = select(func.count()).select_from(Document).where(Document.project_id == project.id)
        doc_count_result = await db.execute(doc_count_query)
        doc_count = doc_count_result.scalar() or 0

        # Create response with document count
        project_dict = {
            "id": str(project.id),
            "name": project.name,
            "code": project.code,
            "brief": project.brief,
            "description": project.description,
            "status": project.status,
            "created_by": str(project.created_by),
            "created_at": project.created_at,
            "updated_at": project.updated_at,
            "document_count": doc_count
        }
        project_responses.append(ProjectResponse(**project_dict))

    return ProjectListResponse(
        projects=project_responses,
        total=total,
        skip=skip,
        limit=limit
    )


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_in: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create new project with optional initial members
    """
    # Check if project code already exists
    existing = await crud_project.get_by_code(db, code=project_in.code)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project with this code already exists"
        )

    # Create project
    project = await crud_project.create(
        db,
        obj_in=project_in,
        created_by=str(current_user.id)
    )

    # Add creator as project owner
    owner_member = ProjectMemberCreate(
        project_id=str(project.id),
        user_id=str(current_user.id),
        role=ProjectRoleEnum.OWNER
    )

    await crud_project_member.create(
        db,
        obj_in=owner_member,
        added_by=str(current_user.id)
    )

    # Add initial members if provided
    if project_in.member_ids and len(project_in.member_ids) > 0:
        for member_id in project_in.member_ids:
            # Skip if trying to add the creator again
            if member_id == str(current_user.id):
                continue

            # Get role from member_roles mapping, default to VIEWER
            role_str = project_in.member_roles.get(member_id, "VIEWER") if project_in.member_roles else "VIEWER"

            # Validate role
            try:
                role = ProjectRoleEnum(role_str)
            except ValueError:
                role = ProjectRoleEnum.VIEWER

            # Create member
            member_in = ProjectMemberCreate(
                project_id=str(project.id),
                user_id=member_id,
                role=role
            )

            await crud_project_member.create(
                db,
                obj_in=member_in,
                added_by=str(current_user.id)
            )

    await db.commit()
    await db.refresh(project)

    return ProjectResponse.model_validate(project)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get project by ID
    """
    # Check access
    await check_project_access(project_id, current_user=current_user, db=db)
    
    project = await crud_project.get(db, id=project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    return ProjectResponse.model_validate(project)


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_in: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update project
    Only project owner or admin can update
    """
    # Check if user is owner
    await check_project_owner(project_id, current_user=current_user, db=db)
    
    project = await crud_project.get(db, id=project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Update project
    project = await crud_project.update(db, db_obj=project, obj_in=project_in)
    await db.commit()
    await db.refresh(project)
    
    return ProjectResponse.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete project
    Only project owner or admin can delete
    """
    # Check if user is owner
    await check_project_owner(project_id, current_user=current_user, db=db)
    
    project = await crud_project.get(db, id=project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    await crud_project.delete(db, id=project_id)
    await db.commit()


@router.post("/{project_id}/archive", response_model=ProjectResponse)
async def archive_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Archive project (soft delete)
    """
    await check_project_owner(project_id, current_user=current_user, db=db)
    
    project = await crud_project.archive(db, project_id=project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    await db.commit()
    await db.refresh(project)
    
    return ProjectResponse.model_validate(project)


@router.post("/{project_id}/restore", response_model=ProjectResponse)
async def restore_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Restore archived project
    """
    await check_project_owner(project_id, current_user=current_user, db=db)
    
    project = await crud_project.restore(db, project_id=project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    await db.commit()
    await db.refresh(project)
    
    return ProjectResponse.model_validate(project)


@router.get("/{project_id}/stats", response_model=ProjectStatsResponse)
async def get_project_stats(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get project statistics
    """
    await check_project_access(project_id, current_user=current_user, db=db)
    
    stats = await crud_project.get_project_stats(db, project_id=project_id)
    
    return ProjectStatsResponse(**stats)


# ============================================
# Project Members Management
# ============================================

@router.get("/{project_id}/members", response_model=List[ProjectMemberResponse])
async def list_project_members(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    List all project members with user details
    """
    await check_project_access(project_id, current_user=current_user, db=db)

    members = await crud_project_member.get_project_members(db, project_id=project_id)

    # Add user details to each member
    result = []
    for member in members:
        member_dict = {
            "id": str(member.id),
            "project_id": str(member.project_id),
            "user_id": str(member.user_id),
            "role": member.role.value if hasattr(member.role, 'value') else str(member.role),
            "added_by": str(member.added_by) if member.added_by else None,
            "added_at": member.added_at,
            "user_name": member.user.full_name if member.user else None,
            "user_email": member.user.email if member.user else None,
        }
        result.append(ProjectMemberResponse(**member_dict))

    return result


@router.post("/{project_id}/members", response_model=ProjectMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_project_member(
    project_id: str,
    member_in: ProjectMemberCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Add member to project
    Only project owner can add members
    """
    await check_project_owner(project_id, current_user=current_user, db=db)
    
    # Ensure project_id matches
    if member_in.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project ID mismatch"
        )
    
    # Check if already a member
    existing = await crud_project_member.get_member(
        db,
        project_id=project_id,
        user_id=member_in.user_id
    )
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a project member"
        )
    
    # Add member
    member = await crud_project_member.create(
        db,
        obj_in=member_in,
        added_by=str(current_user.id)
    )

    await db.commit()
    await db.refresh(member)

    # Load user details
    from sqlalchemy.orm import selectinload
    from sqlalchemy import select as sql_select
    result = await db.execute(
        sql_select(crud_project_member.model)
        .options(selectinload(crud_project_member.model.user))
        .where(crud_project_member.model.id == member.id)
    )
    member_with_user = result.scalar_one()

    # Build response with user details
    member_dict = {
        "id": str(member_with_user.id),
        "project_id": str(member_with_user.project_id),
        "user_id": str(member_with_user.user_id),
        "role": member_with_user.role.value if hasattr(member_with_user.role, 'value') else str(member_with_user.role),
        "added_by": str(member_with_user.added_by) if member_with_user.added_by else None,
        "added_at": member_with_user.added_at,
        "user_name": member_with_user.user.full_name if member_with_user.user else None,
        "user_email": member_with_user.user.email if member_with_user.user else None,
    }

    return ProjectMemberResponse(**member_dict)


@router.put("/{project_id}/members/{user_id}/role")
async def update_member_role(
    project_id: str,
    user_id: str,
    role: ProjectRoleEnum,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update member's role in project
    """
    await check_project_owner(project_id, current_user=current_user, db=db)
    
    member = await crud_project_member.update_role(
        db,
        project_id=project_id,
        user_id=user_id,
        role=role.value
    )
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )
    
    await db.commit()
    await db.refresh(member)
    
    return ProjectMemberResponse.model_validate(member)


@router.delete("/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_project_member(
    project_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Remove member from project
    """
    await check_project_owner(project_id, current_user=current_user, db=db)
    
    # Don't allow removing the owner
    member = await crud_project_member.get_member(db, project_id=project_id, user_id=user_id)
    if member and str(getattr(member, 'role', '')) == ProjectRoleEnum.OWNER.value:
        # Check if it's the last owner
        owners = await crud_project_member.get_by_role(
            db,
            project_id=project_id,
            role=ProjectRoleEnum.OWNER.value
        )
        if len(owners) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last owner from project"
            )
    
    success = await crud_project_member.remove_member(
        db,
        project_id=project_id,
        user_id=user_id
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )
    
    await db.commit()


@router.post("/{project_id}/members/bulk", response_model=List[ProjectMemberResponse])
async def bulk_add_members(
    project_id: str,
    user_ids: List[str],
    role: ProjectRoleEnum = ProjectRoleEnum.VIEWER,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Add multiple members to project at once
    """
    await check_project_owner(project_id, current_user=current_user, db=db)
    
    members = await crud_project_member.bulk_add_members(
        db,
        project_id=project_id,
        user_ids=user_ids,
        role=role.value,
        added_by=str(current_user.id)
    )
    
    await db.commit()
    
    # Refresh all members
    for member in members:
        await db.refresh(member)
    
    return [ProjectMemberResponse.model_validate(m) for m in members]