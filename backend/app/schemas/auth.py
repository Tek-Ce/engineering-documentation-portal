# ============================================
# FILE: app/schemas/auth.py
# ============================================
from pydantic import BaseModel, Field, constr
from app.schemas.user import UserResponse


class LoginRequest(BaseModel):
    """Login request - accepts form data from OAuth2PasswordBearer"""
    username: constr(strip_whitespace=True, min_length=3) = Field(  # type: ignore
        ..., 
        description="Email address"
    )
    password: str = Field(
        ...,
        description="User password"
    )


class TokenResponse(BaseModel):
    """Token response after successful login"""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class PasswordChange(BaseModel):
    """Password change request"""
    current_password: str
    new_password: str = Field(..., min_length=8)