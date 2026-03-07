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

# In-memory token stores (for production, use Redis or database)
reset_tokens: dict = {}
verification_tokens: dict = {}  # token → user email

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

@router.post("/login", response_model=TokenResponse)
async def login(
    username: str = Form(...),
    password: str = Form(...),
    request: "Request" = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Login with email and password.
    Returns specific error codes so the frontend can show helpful messages.
    """
    from fastapi import Request as _Request

    # Step 1: does this email exist at all?
    existing = await crud_user.get_by_email(db, email=username)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="NO_ACCOUNT"   # no account with this email
        )

    # Step 2: verify password
    user: Optional[User] = await crud_user.authenticate(db, email=username, password=password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="WRONG_PASSWORD"
        )

    # Step 3: account checks
    if not bool(user.is_active):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="ACCOUNT_INACTIVE")

    if not bool(user.is_email_verified):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="EMAIL_NOT_VERIFIED")

    # Create JWT access token
    access_token = create_access_token(
        data={"sub": str(user.id), "role": str(user.role.value)}
    )

    # Update last login timestamp
    await db.execute(update(User).where(User.id == user.id).values(last_login=func.now()))
    await db.commit()
    await db.refresh(user)

    # Send login alert email if user has opted in (fire-and-forget)
    if bool(user.notify_login_alert):
        try:
            from app.services.email_service import EmailService
            await EmailService.send_login_alert(
                to_email=str(user.email),
                to_name=str(user.full_name),
            )
        except Exception as e:
            print(f"[Auth] Login alert email failed: {e}")

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

    return TokenResponse(access_token=access_token, token_type="bearer", user=user_response)

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

    # Notify user of password change if security events are enabled
    if bool(current_user.notify_security_events):
        try:
            from app.services.email_service import EmailService
            await EmailService.send_password_changed(
                to_email=str(current_user.email),
                to_name=str(current_user.full_name),
            )
        except Exception as e:
            print(f"[Auth] Password changed email failed: {e}")

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
    Request password reset — sends a secure reset link via Resend email.
    Always returns the same message to avoid revealing whether an email exists.
    """
    user = await crud_user.get_by_email(db, email=request.email)

    if user:
        # Generate secure random token
        token = secrets.token_urlsafe(32)
        reset_tokens[token] = str(user.email)

        # Send email via Resend (fire-and-forget — don't fail if email fails)
        try:
            from app.services.email_service import EmailService
            await EmailService.send_password_reset(
                to_email=str(user.email),
                to_name=str(user.full_name),
                reset_token=token,
            )
        except Exception as e:
            # Log but don't expose error to client
            print(f"[Auth] Email send failed for {request.email}: {e}")

    return {"message": "If that email is registered, a password reset link has been sent."}

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


@router.get("/verify-email")
async def verify_email(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Verify a user's email address via the link sent in the welcome email.
    Marks the account as verified so they can log in.
    """
    email = verification_tokens.get(token)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification link. Please ask your admin to resend the invitation."
        )

    user = await crud_user.get_by_email(db, email=email)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if bool(user.is_email_verified):
        del verification_tokens[token]
        return {"message": "Email already verified. You can now log in."}

    await db.execute(
        update(User)
        .where(User.id == user.id)
        .values(is_email_verified=True, is_active=True)
    )
    await db.commit()

    # Consume the token
    del verification_tokens[token]

    return {"message": "Email verified successfully! You can now log in."}


@router.post("/resend-verification")
async def resend_verification(
    request: PasswordResetRequest,   # reuse the {email} schema
    db: AsyncSession = Depends(get_db)
):
    """
    Resend the email verification link for a user who hasn't verified yet.
    """
    user = await crud_user.get_by_email(db, email=request.email)

    if user and not bool(user.is_email_verified):
        token = secrets.token_urlsafe(32)
        verification_tokens[token] = str(user.email)

        try:
            from app.services.email_service import EmailService
            await EmailService.send_welcome_verification(
                to_email=str(user.email),
                to_name=str(user.full_name),
                verification_token=token,
            )
        except Exception as e:
            print(f"[Auth] Resend verification failed for {request.email}: {e}")

    # Always return same message to avoid email enumeration
    return {"message": "If that account exists and is unverified, a new verification link has been sent."}