# ============================================
# FILE: app/core/config.py
# Pydantic v2 configuration for FastAPI project
# ============================================

from typing import List, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"  # Allows extra fields in .env without errors
    )

    # Application settings
    APP_NAME: str = "Engineering Documentation Portal"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # API prefix
    API_V1_STR: str = "/api/v1"

    # Database configuration
    DATABASE_URL: str = Field(default_factory=lambda: "", min_length=1)
    SECRET_KEY: str = Field(default_factory=lambda: "", min_length=1)

    # Security configuration
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # File upload settings
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE: int = 52428800  # 50 MB
    ALLOWED_EXTENSIONS: List[str] = Field(default_factory=lambda: [
        ".pdf", ".docx", ".doc", ".md", ".txt", ".xlsx", ".pptx"
    ])

    # CORS settings
    CORS_ORIGINS: List[str] = Field(default_factory=lambda: [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080"
    ])

    # Email settings (Optional)
    SMTP_HOST: Optional[str] = "smtp.gmail.com"
    SMTP_PORT: Optional[int] = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: Optional[str] = None

# Instantiate settings
settings = Settings()  # type: ignore