"""
Users API Endpoints
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserListResponse, ProfileUpdate, PasswordChange
from app.crud.user import crud_user
from app.api.deps import get_current_user, get_current_active_user, require_role
from app.core.security import verify_password, get_password_hash


router = APIRouter()

# ==========================================
# PROFILE ENDPOINTS (Self-service)
# ==========================================

@router.get("/me", response_model=UserResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_active_user)
):
    """Get current user's profile"""
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_my_profile(
    profile_update: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update current user's profile (name only, not role)"""
    # Update only allowed fields
    if profile_update.full_name is not None:
        current_user.full_name = profile_update.full_name  # type: ignore

    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.post("/me/change-password")
async def change_my_password(
    password_change: PasswordChange,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Change current user's password"""
    # Verify current password
    if not verify_password(password_change.current_password, current_user.password_hash):  # type: ignore
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    # Update password
    current_user.password_hash = get_password_hash(password_change.new_password)  # type: ignore
    await db.commit()

    return {"message": "Password changed successfully"}


# ==========================================
# ADMIN ENDPOINTS
# ==========================================

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN))
):
    """Create new user (Admin only)"""
    existing_user = await crud_user.get_by_email(db, email=user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    user = await crud_user.create(
        db,
        obj_in=user_in,
        created_by_id=str(current_user.id)
    )
    # New users must verify their email before logging in
    user.is_email_verified = False  # type: ignore
    await db.commit()
    await db.refresh(user)

    # Generate verification token and send welcome email
    import secrets as _secrets
    from app.api.v1.auth import verification_tokens
    token = _secrets.token_urlsafe(32)
    verification_tokens[token] = str(user.email)

    try:
        from app.services.email_service import EmailService
        await EmailService.send_welcome_verification(
            to_email=str(user.email),
            to_name=str(user.full_name),
            verification_token=token,
        )
    except Exception as e:
        print(f"[Users] Welcome email failed for {user.email}: {e}")

    return UserResponse.model_validate(user)


@router.get("", response_model=UserListResponse)
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None, description="Search users by name or email"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN))
):
    """List all users (Admin only)"""
    if search:
        users, total = await crud_user.search(db, query=search, skip=skip, limit=limit)
    elif is_active is not None:
        users, total = await crud_user.get_active_users(db, skip=skip, limit=limit) if is_active else ([], 0)
    else:
        users, total = await crud_user.get_multi(db, skip=skip, limit=limit)

    return UserListResponse(
        users=[UserResponse.model_validate(u) for u in users],
        total=total,
        page=skip // limit + 1,
        page_size=limit
    )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN))
):
    """Get user by ID (Admin only)"""
    user = await crud_user.get(db, id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_in: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN))
):
    """Update user (Admin only)"""
    user = await crud_user.get(db, id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user = await crud_user.update(db, db_obj=user, obj_in=user_in)
    await db.commit()
    return UserResponse.model_validate(user)


@router.delete("/{user_id}")
async def deactivate_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN))
):
    """Deactivate user (Admin only)"""
    # Prevent deactivating your own account
    if user_id == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account"
        )

    # Get the target user
    target_user = await crud_user.get(db, id=user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Protect default system admin from deletion
    if target_user.email == "admin@engportal.local":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot deactivate the default system administrator account"
        )

    success = await crud_user.deactivate(db, id=user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    await db.commit()
    return {"message": "User deactivated successfully"}