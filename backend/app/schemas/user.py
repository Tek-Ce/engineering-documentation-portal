# ============================================
# FILE: app/schemas/user.py
# ============================================
from pydantic import BaseModel, EmailStr, Field, ConfigDict, constr, ConfigDict
from typing import Optional
from datetime import datetime
from app.models.user import UserRole

class UserBase(BaseModel):
    email: constr(strip_whitespace=True, min_length=3) # type: ignore
    full_name: str = Field(..., min_length=1, max_length=150)
    role: str = Field(..., pattern="^(ADMIN|ENGINEER|VIEWER)$")

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=100)

class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=150)
    role: Optional[str] = Field(None, pattern="^(ADMIN|ENGINEER|VIEWER)$")
    is_active: Optional[bool] = None

class ProfileUpdate(BaseModel):
    """Schema for users to update their own profile (non-admin fields only)"""
    full_name: Optional[str] = Field(None, min_length=1, max_length=150)

class PasswordChange(BaseModel):
    """Schema for changing password"""
    current_password: str = Field(..., min_length=8, max_length=100)
    new_password: str = Field(..., min_length=8, max_length=100)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)  # 👈 key part

    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    last_login: Optional[datetime]
    created_at: datetime
    updated_at: datetime

class UserListResponse(BaseModel):
    users: list[UserResponse]
    total: int
    page: int
    page_size: int