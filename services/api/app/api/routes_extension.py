from datetime import datetime, timezone
import re

from fastapi import APIRouter, Header, HTTPException, status

from app.api.routes_influencers import invalidate_influencer_cache
from app.core.config import get_settings
from app.db.mongodb import get_influencers_collection
from app.schemas.extension import ExtensionIngestResponse, InfluencerPayload
from app.services.influencer_analytics import normalize_scraped_document_with_source

router = APIRouter(prefix="/extension", tags=["extension"])


@router.post("/influencers", response_model=ExtensionIngestResponse)
def ingest_influencer(
    payload: InfluencerPayload,
    x_extension_key: str | None = Header(default=None, alias="X-Extension-Key"),
) -> ExtensionIngestResponse:
    settings = get_settings()
    if not x_extension_key or x_extension_key != settings.extension_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid extension key")

    raw = payload.model_dump(exclude_none=True)
    try:
        normalized = normalize_scraped_document_with_source(raw, source="extension")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="username (or unique_id/handle) is required",
        ) from exc

    now = datetime.now(timezone.utc)
    collection = get_influencers_collection()
    escaped_username = re.escape(normalized["username"])
    username_filter = {"username": {"$regex": f"^{escaped_username}$", "$options": "i"}}

    result = collection.update_one(
        username_filter,
        {
            "$set": normalized,
            "$setOnInsert": {
                "createdAt": now,
            },
        },
        upsert=True,
    )

    saved = collection.find_one(
        username_filter,
        {"_id": 1},
    )
    if not saved:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to persist influencer")

    invalidate_influencer_cache()
    return ExtensionIngestResponse(
        id=str(saved["_id"]),
        username=normalized["username"],
        upserted=result.upserted_id is not None,
        updated_at=now,
        saved_fields={
            "source": normalized["source"],
            "username": normalized["username"],
        },
    )
