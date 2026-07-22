from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


class KnowledgeSourceOut(BaseModel):
    id: uuid.UUID
    agent_type: str
    name: str
    source_type: str
    status: str
    chunk_count: int
    version: int
    error_detail: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
