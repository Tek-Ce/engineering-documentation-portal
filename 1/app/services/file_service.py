"""
File Service - Handle file uploads and storage
"""
import os
import uuid
from pathlib import Path
from typing import Dict, Optional
from fastapi import UploadFile, HTTPException
import aiofiles
from datetime import datetime, timezone


class FileService:
    """Service for handling file operations"""
    
    # Configuration
    UPLOAD_DIR = Path("uploads")
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    ALLOWED_EXTENSIONS = {
        'documents': {'.pdf', '.doc', '.docx', '.txt', '.md', '.xlsx', '.xls', '.ppt', '.pptx'},
        'images': {'.jpg', '.jpeg', '.png', '.gif', '.svg'},
        'archives': {'.zip', '.tar', '.gz'}
    }
    
    @classmethod
    def get_upload_path(cls, subfolder: str = "") -> Path:
        """Get upload directory path"""
        path = cls.UPLOAD_DIR / subfolder
        path.mkdir(parents=True, exist_ok=True)
        return path
    
    @classmethod
    def validate_file(cls, file: UploadFile, category: str = 'documents') -> None:
        """Validate file before upload"""
        # Check file extension
        file_ext = Path(file.filename or '').suffix.lower()
        allowed = cls.ALLOWED_EXTENSIONS.get(category, set())
        
        if file_ext not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"File type {file_ext} not allowed. Allowed types: {', '.join(allowed)}"
            )
    
    @classmethod
    async def save_file(
        cls,
        file: UploadFile,
        subfolder: str = "documents",
        validate: bool = True
    ) -> Dict[str, str | int ]:
        """
        Save uploaded file to disk
        
        Returns dict with file metadata:
        - filename: Original filename
        - stored_filename: Unique stored filename
        - file_path: Relative path to file
        - file_size: File size in bytes
        - mime_type: File MIME type
        """
        # Validate if requested
        if validate:
            cls.validate_file(file, category=subfolder)
        
        # Generate unique filename
        file_ext = Path(file.filename or 'file').suffix
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        
        # Get upload path
        upload_path = cls.get_upload_path(subfolder)
        file_path = upload_path / unique_filename
        
        # Save file
        file_size = 0
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            file_size = len(content)
            
            # Check file size
            if file_size > cls.MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=400,
                    detail=f"File too large. Maximum size: {cls.MAX_FILE_SIZE / (1024*1024)}MB"
                )
            
            await f.write(content)
        
        # Return metadata
        return {
            "filename": file.filename or unique_filename,
            "stored_filename": unique_filename,
            "file_path": str(Path(subfolder) / unique_filename),
            "file_size": file_size,
            "mime_type": file.content_type or "application/octet-stream"
        }
    
    @classmethod
    async def delete_file(cls, file_path: str) -> bool:
        """Delete a file"""
        try:
            full_path = cls.UPLOAD_DIR / file_path
            if full_path.exists():
                full_path.unlink()
                return True
        except Exception:
            pass
        return False
    
    @classmethod
    def get_file_url(cls, file_path: str, base_url: str = "") -> str:
        """Get public URL for a file"""
        return f"{base_url}/files/{file_path}"