from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class InfluencerPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    username: str | None = None
    unique_id: str | None = None
    handle: str | None = None


class ExtensionIngestResponse(BaseModel):
    id: str
    username: str
    upserted: bool
    updated_at: datetime
    saved_fields: dict[str, Any]
