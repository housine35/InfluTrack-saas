from __future__ import annotations

import time

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.routes_influencers import invalidate_influencer_cache
from app.core.deps import get_current_user
from app.schemas.scraper import TikTokScrapeRunRequest, TikTokScrapeRunResponse
from app.services.tiktok_scraper import run_tiktok_scraper_for_username

router = APIRouter(prefix="/scraper", tags=["scraper"])


@router.post("/tiktok/run", response_model=TikTokScrapeRunResponse)
async def run_tiktok_scrape(
    payload: TikTokScrapeRunRequest,
    _: dict = Depends(get_current_user),
) -> TikTokScrapeRunResponse:
    started_at = time.perf_counter()

    try:
        result = await run_tiktok_scraper_for_username(
            username=payload.username,
            force_refresh=payload.force_refresh,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=result.get("error") or "TikTok scraping failed.",
        )

    invalidate_influencer_cache()
    duration_ms = int((time.perf_counter() - started_at) * 1000)

    return TikTokScrapeRunResponse(
        success=True,
        username=result["username"],
        message=result["message"],
        item_count=result.get("item_count", 0),
        new_items=result.get("new_items", 0),
        updated_items=result.get("updated_items", 0),
        total_items=result.get("total_items", 0),
        batch_count=result.get("batch_count", 0),
        used_proxy=result.get("used_proxy"),
        duration_ms=duration_ms,
        fetched_at=result.get("fetched_at"),
    )
