import time
import uuid
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class JobType(str, Enum):
    REMOVE_BG = "remove_bg"
    VECTORIZE = "vectorize"


class Job(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8].upper())
    type: JobType
    status: JobStatus = JobStatus.PENDING
    progress: int = 0
    message: str = "En attente dans la file..."
    created_at: float = Field(default_factory=time.time)
    completed_at: Optional[float] = None
    error: Optional[str] = None
    result_path: Optional[str] = None
    original_filename: str = ""
    file_size: int = 0
    result_extension: str = "png"
    vectorize_params: Optional[dict] = None
