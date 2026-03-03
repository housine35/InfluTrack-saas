from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class TikTokScrapeRunRequest(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    force_refresh: bool = False


class TikTokScrapeRunResponse(BaseModel):
    success: bool = False
    username: str
    message: str
    item_count: int = 0
    new_items: int = 0
    updated_items: int = 0
    total_items: int = 0
    batch_count: int = 0
    used_proxy: str | None = None
    duration_ms: int = 0
    fetched_at: datetime | None = None
