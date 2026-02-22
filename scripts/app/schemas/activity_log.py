from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone

class ActivityLogBase(BaseModel):
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    description: Optional[str] = None
    ip_address: Optional[str] = None

class ActivityLogCreate(ActivityLogBase):
    user_id: Optional[str] = None
    project_id: Optional[str] = None

class ActivityLogResponse(ActivityLogBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: Optional[str] = None
    project_id: Optional[str] = None
    created_at: datetime
