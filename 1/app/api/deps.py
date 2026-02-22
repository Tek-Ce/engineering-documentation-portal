"""
API dependencies for authentication and authorization
"""
from typing import Optional, Callable
from dataclasses import dataclass
from fastapi import Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.config import settings
from app.db.database import get_db
from app.models.user import User, UserRole
from app.crud.user import crud_user
from app.models.project_member import ProjectMember, ProjectMemberRole
from app.core.security import decode_token


# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Optional bearer scheme for flexible auth
optional_oauth2_scheme = HTTPBearer(auto_error=False)


async def get_token_from_query_or_header(
    token_query: Optional[str] = Query(None, alias="token"),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_oauth2_scheme)
) -> str:
    """
    Get token from query parameter (for iframe/preview) or Authorization header
    Query parameter takes precedence for iframe compatibility
    """
    # Try query parameter first (for iframe)
    if token_query:
        return token_query

    # Try Authorization header
    if credentials and credentials.credentials:
        return credentials.credentials

    # No token found
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(get_token_from_query_or_header)
) -> User:
    """
    Get current authenticated user from JWT token (supports both header and query param)
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await crud_user.get(db, id=user_id)
    if user is None:
        raise credentials_exception

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Ensure the user is active"""
    if not getattr(current_user, "is_active", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


def _get_role_value(role) -> str:
    """
    Helper function to extract the string value from a role (Enum or string)
    """
    if hasattr(role, "value"):
        return str(role.value)
    return str(role)


async def get_current_admin_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """Ensure the user is an admin"""
    user_role = _get_role_value(getattr(current_user, "role", ""))
    if user_role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requires ADMIN role"
        )
    return current_user


async def get_current_manager_or_admin(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """Ensure the user is a manager or admin"""
    user_role = _get_role_value(getattr(current_user, "role", ""))
    if user_role not in ["ADMIN", "MANAGER"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requires ADMIN or MANAGER role"
        )
    return current_user


def require_role(required_role: UserRole) -> Callable:
    """
    Dependency factory to enforce a specific role
    
    Usage:
        @router.get("/admin-only")
        async def admin_endpoint(
            current_user: User = Depends(require_role(UserRole.ADMIN))
        ):
            ...
    """
    async def role_checker(
        current_user: User = Depends(get_current_active_user)
    ) -> User:
        user_role_str = _get_role_value(getattr(current_user, "role", ""))
        required_role_str = _get_role_value(required_role)
        
        if user_role_str != required_role_str:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires {required_role_str} role"
            )
        return current_user
    
    return role_checker


# Dataclass to represent project access info (type-safe)
@dataclass
class ProjectAccessInfo:
    user_id: str
    project_id: str
    role: ProjectMemberRole


# ----------------------
# Project-related dependencies
# ----------------------

async def check_project_access(
    project_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> ProjectAccessInfo:
    """
    Check if user has access to project
    Returns a ProjectAccessInfo object for further checks
    """
    from app.crud.project import crud_project

    project = await crud_project.get(db, id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    user_role = _get_role_value(getattr(current_user, "role", ""))
    
    # Admin has access to all projects
    if user_role == "ADMIN":
        return ProjectAccessInfo(
            user_id=str(current_user.id),
            project_id=project_id,
            role=ProjectMemberRole.OWNER
        )

    # Check membership
    result = await db.execute(
        select(ProjectMember).where(
            and_(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == str(current_user.id)
            )
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this project")
    
    return ProjectAccessInfo(
        user_id=str(member.user_id),
        project_id=str(member.project_id),
        role=ProjectMemberRole(member.role)  # cast string to enum
    )


async def check_project_owner(
    project_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> ProjectAccessInfo:
    """
    Ensure the user is the project owner
    """
    member_info = await check_project_access(project_id, current_user, db)
    
    if member_info.role != ProjectMemberRole.OWNER:
        raise HTTPException(
            status_code=403,
            detail="Only project owner can perform this action"
        )
    
    return member_info