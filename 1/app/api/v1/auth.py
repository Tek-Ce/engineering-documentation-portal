# ============================================
# FILE: app/api/v1/auth.py
# ============================================
from fastapi import APIRouter, Depends, HTTPException, status, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update
from sqlalchemy.sql import func
from typing import Optional, cast
from datetime import datetime
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import TokenResponse, PasswordChange
from app.schemas.user import UserResponse
from app.core.security import verify_password, create_access_token, get_password_hash
from app.api.deps import get_current_user
from app.crud.user import crud_user
from pydantic import BaseModel, EmailStr
import secrets

router = APIRouter()

# In-memory token store (for production, use Redis or database)
reset_tokens = {}

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

@router.post("/login", response_model=TokenResponse)
async def login(
    username: str = Form(...),
    password: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Login with email and password
    
    Accepts form-encoded data (username and password fields)
    """
    user: Optional[User] = await crud_user.authenticate(
        db, email=username, password=password
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if not bool(user.is_active):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    # Create JWT access token
    access_token = create_access_token(
        data={"sub": str(user.id), "role": str(user.role.value)}
    )
    
    # Update last login timestamp
    await db.execute(
        update(User)
        .where(User.id == user.id)
        .values(last_login=func.now())
    )
    await db.commit()
    await db.refresh(user)
    
    # ✅ Manually build UserResponse to avoid async lazy-load issues
    user_response = UserResponse(
        id=str(user.id),
        email=str(user.email),
        full_name=str(user.full_name),
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        is_active=bool(user.is_active),
        last_login=cast(Optional[datetime], user.last_login),
        created_at=cast(datetime, user.created_at),
        updated_at=cast(datetime, user.updated_at)
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )

@router.post("/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Change current user's password"""
    hashed_password: str = str(current_user.password_hash)
    
    if not verify_password(password_data.current_password, hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    await db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(password_hash=get_password_hash(password_data.new_password))
    )
    await db.commit()
    await db.refresh(current_user)
    
    return {"message": "Password changed successfully"}

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return UserResponse(
        id=str(current_user.id),
        email=str(current_user.email),
        full_name=str(current_user.full_name),
        role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        is_active=bool(current_user.is_active),
        last_login=cast(Optional[datetime], current_user.last_login),
        created_at=cast(datetime, current_user.created_at),
        updated_at=cast(datetime, current_user.updated_at)
    )

@router.post("/forgot-password")
async def forgot_password(
    request: PasswordResetRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Request password reset

    Generates a reset token for the user.
    In production, this would send an email with the token.
    """
    user = await crud_user.get_by_email(db, email=request.email)

    if not user:
        # Don't reveal if user exists for security
        return {"message": "If the email exists, a reset token has been generated"}

    # Generate secure random token
    token = secrets.token_urlsafe(32)

    # Store token with user email (expires in 1 hour in production)
    reset_tokens[token] = str(user.email)

    # In production, send email with reset link
    # For now, return token for testing
    return {
        "message": "Password reset token generated",
        "token": token,  # Remove this in production
        "note": "In production, this token would be sent via email"
    }

@router.post("/reset-password")
async def reset_password(
    request: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db)
):
    """
    Reset password using token
    """
    # Validate token
    email = reset_tokens.get(request.token)

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    # Get user
    user = await crud_user.get_by_email(db, email=email)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Update password
    await db.execute(
        update(User)
        .where(User.id == user.id)
        .values(password_hash=get_password_hash(request.new_password))
    )
    await db.commit()

    # Invalidate token
    del reset_tokens[request.token]

    return {"message": "Password reset successfully"}