from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.config import get_settings
from app.core.deps import get_current_user
from app.db.mongodb import get_influencers_collection
from app.schemas.influencer import (
    AdvancedMetricsLeaders,
    AdvancedMetricsResponse,
    DashboardOverview,
    InfluencerAdvancedMetrics,
    InfluencerDetail,
    InfluencerGrowth,
    InfluencerImportRequest,
    InfluencerImportResponse,
    InfluencerListResponse,
    InfluencerSummary,
    OriginalIdeasResponse,
    TopGrowthResponse,
    TopInfluencersResponse,
    TopVideo,
    TopVideosResponse,
)
from app.services.influencer_analytics import (
    advanced_metrics,
    build_dashboard_overview,
    build_influencer_detail,
    build_influencer_summary,
    normalize_scraped_document_with_source,
    original_ideas,
    top_growth,
    top_videos,
)

router = APIRouter(tags=["influencers"])
settings = get_settings()

# Keep payloads small for analytics/list requests.
SUMMARY_PROJECTION = {
    "username": 1,
    "username_normalized": 1,
    "domain": 1,
    "domain_confidence": 1,
    "fetchedAt": 1,
    "history": 1,
    "latest": 1,
    "data.itemList.id": 1,
    "data.itemList.createTime": 1,
    "data.itemList.stats.playCount": 1,
    "data.itemList.stats.diggCount": 1,
    "data.itemList.stats.commentCount": 1,
    "data.itemList.stats.shareCount": 1,
    "data.itemList.stats.collectCount": 1,
    "data.itemList.author.uniqueId": 1,
    "data.itemList.author.nickname": 1,
    "data.itemList.author.avatarThumb": 1,
    "data.itemList.author.verified": 1,
    "data.itemList.authorStats": 1,
}

_CACHE_TTL_SECONDS = settings.influencer_cache_ttl_seconds
_CACHE: dict[str, Any] = {
    "expires_at": 0.0,
    "docs": [],
    "summaries": [],
    "advanced_metrics": None,
}


def invalidate_influencer_cache() -> None:
    _CACHE["expires_at"] = 0.0
    _CACHE["docs"] = []
    _CACHE["summaries"] = []
    _CACHE["advanced_metrics"] = None


def warm_influencer_cache() -> None:
    _get_cached_docs_and_summaries()


def _get_cached_docs_and_summaries() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    now = time.time()
    if _CACHE["expires_at"] > now:
        return _CACHE["docs"], _CACHE["summaries"]

    collection = get_influencers_collection()
    docs = list(collection.find({}, SUMMARY_PROJECTION))
    summaries = [build_influencer_summary(doc) for doc in docs]

    _CACHE["docs"] = docs
    _CACHE["summaries"] = summaries
    _CACHE["advanced_metrics"] = None
    _CACHE["expires_at"] = now + _CACHE_TTL_SECONDS
    return docs, summaries


def _get_cached_advanced_metrics(limit: int) -> dict[str, Any]:
    now = time.time()
    cached = _CACHE.get("advanced_metrics")
    if isinstance(cached, dict) and _CACHE["expires_at"] > now:
        return {
            "generated_at": cached.get("generated_at"),
            "leaders": {
                key: rows[:limit]
                for key, rows in (cached.get("leaders") or {}).items()
            },
        }

    docs, _ = _get_cached_docs_and_summaries()
    full_payload = advanced_metrics(
        docs,
        limit=max(limit, settings.advanced_metrics_cache_compute_limit),
    )
    _CACHE["advanced_metrics"] = full_payload
    return {
        "generated_at": full_payload.get("generated_at"),
        "leaders": {
            key: rows[:limit]
            for key, rows in (full_payload.get("leaders") or {}).items()
        },
    }


@router.get("/dashboard/overview", response_model=DashboardOverview)
def dashboard_overview(_: dict = Depends(get_current_user)) -> DashboardOverview:
    _, summaries = _get_cached_docs_and_summaries()
    return DashboardOverview(**build_dashboard_overview(summaries))


@router.get("/insights/top-influencers", response_model=TopInfluencersResponse)
def insights_top_influencers(
    _: dict = Depends(get_current_user),
    metric: Literal["followers", "views", "engagement"] = Query(default="followers"),
    limit: int = Query(default=settings.insights_top_influencers_default_limit, ge=1, le=100),
) -> TopInfluencersResponse:
    _, summaries = _get_cached_docs_and_summaries()
    ranked = list(summaries)

    sort_map = {
        "followers": lambda item: item["followers"],
        "views": lambda item: item["total_views"],
        "engagement": lambda item: item["engagement_rate"],
    }
    ranked.sort(key=sort_map[metric], reverse=True)
    return TopInfluencersResponse(items=[InfluencerSummary(**item) for item in ranked[:limit]])


@router.get("/insights/top-videos", response_model=TopVideosResponse)
def insights_top_videos(
    _: dict = Depends(get_current_user),
    limit: int = Query(default=settings.insights_top_videos_default_limit, ge=1, le=200),
) -> TopVideosResponse:
    docs, _ = _get_cached_docs_and_summaries()
    videos = [TopVideo(**item) for item in top_videos(docs, limit=limit)]
    return TopVideosResponse(items=videos)


@router.get("/insights/top-growth", response_model=TopGrowthResponse)
def insights_top_growth(
    _: dict = Depends(get_current_user),
    days: int = Query(default=settings.insights_top_growth_default_days, ge=7, le=120),
    limit: int = Query(default=settings.insights_top_growth_default_limit, ge=1, le=100),
) -> TopGrowthResponse:
    docs, _ = _get_cached_docs_and_summaries()
    growth_items = [
        InfluencerGrowth(**item) for item in top_growth(docs, reference_days=days, limit=limit)
    ]
    return TopGrowthResponse(items=growth_items)


@router.get("/insights/original-ideas", response_model=OriginalIdeasResponse)
def insights_original_ideas(
    _: dict = Depends(get_current_user),
) -> OriginalIdeasResponse:
    _, summaries = _get_cached_docs_and_summaries()
    ideas = original_ideas(list(summaries))
    return OriginalIdeasResponse(
        rising_stars=[InfluencerSummary(**item) for item in ideas["rising_stars"]],
        undervalued_creators=[InfluencerSummary(**item) for item in ideas["undervalued_creators"]],
    )


@router.get("/insights/advanced-metrics", response_model=AdvancedMetricsResponse)
def insights_advanced_metrics(
    _: dict = Depends(get_current_user),
    limit: int = Query(default=settings.insights_advanced_metrics_default_limit, ge=3, le=50),
) -> AdvancedMetricsResponse:
    payload = _get_cached_advanced_metrics(limit)

    leaders_payload: dict[str, list[InfluencerAdvancedMetrics]] = {}
    for key, rows in payload["leaders"].items():
        leaders_payload[key] = [InfluencerAdvancedMetrics(**row) for row in rows]

    return AdvancedMetricsResponse(
        generated_at=payload["generated_at"],
        leaders=AdvancedMetricsLeaders(**leaders_payload),
    )


@router.get("/influencers", response_model=InfluencerListResponse)
def list_influencers(
    _: dict = Depends(get_current_user),
    q: str | None = Query(default=None, max_length=120),
    domain: str | None = Query(default=None, max_length=40),
    min_followers: int = Query(default=0, ge=0),
    min_engagement: float = Query(default=0.0, ge=0.0, le=100.0),
    verified_only: bool = Query(default=False),
    updated_within_days: int | None = Query(default=None, ge=1, le=365),
    sort_by: Literal["followers", "views", "engagement", "fetched"] = Query(default="followers"),
    order: Literal["asc", "desc"] = Query(default="desc"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=settings.influencers_list_default_limit, ge=1, le=100),
) -> InfluencerListResponse:
    _, summaries = _get_cached_docs_and_summaries()
    filtered = list(summaries)

    if q:
        search = q.strip().lower()
        filtered = [
            item
            for item in filtered
            if search in item["username"].lower()
            or (item.get("nickname") or "").lower().find(search) >= 0
        ]

    if min_followers > 0:
        filtered = [item for item in filtered if item["followers"] >= min_followers]

    if min_engagement > 0:
        filtered = [item for item in filtered if item["engagement_rate"] >= min_engagement]

    if domain:
        normalized_domain = domain.strip().lower()
        filtered = [
            item
            for item in filtered
            if str(item.get("domain") or "").strip().lower() == normalized_domain
        ]

    if verified_only:
        filtered = [item for item in filtered if item["verified"]]

    if updated_within_days is not None:
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(days=updated_within_days)
        filtered = [
            item
            for item in filtered
            if item.get("fetched_at") is not None and item["fetched_at"] >= cutoff
        ]

    sort_map = {
        "followers": lambda item: item["followers"],
        "views": lambda item: item["total_views"],
        "engagement": lambda item: item["engagement_rate"],
        "fetched": lambda item: item.get("fetched_at") or datetime.min.replace(tzinfo=timezone.utc),
    }
    reverse = order == "desc"
    filtered.sort(key=sort_map[sort_by], reverse=reverse)

    total = len(filtered)
    page_items = filtered[skip : skip + limit]
    return InfluencerListResponse(total=total, items=[InfluencerSummary(**item) for item in page_items])


@router.get("/influencers/{username}", response_model=InfluencerDetail)
def influencer_detail(username: str, _: dict = Depends(get_current_user)) -> InfluencerDetail:
    collection = get_influencers_collection()
    normalized = username.strip().lower()
    doc = collection.find_one({"username_normalized": normalized})
    if not doc:
        doc = collection.find_one({"username": {"$regex": f"^{username}$", "$options": "i"}})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Influencer not found")

    return InfluencerDetail(**build_influencer_detail(doc))


@router.post("/influencers/import", response_model=InfluencerImportResponse, status_code=status.HTTP_201_CREATED)
def import_influencers(
    payload: InfluencerImportRequest,
    _: dict = Depends(get_current_user),
) -> InfluencerImportResponse:
    if not payload.documents:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No documents provided")

    collection = get_influencers_collection()
    imported = 0
    usernames: list[str] = []
    now = datetime.now(timezone.utc)

    for raw_document in payload.documents:
        try:
            source_hint = raw_document.get("source") if isinstance(raw_document, dict) else None
            normalized = normalize_scraped_document_with_source(raw_document, source=source_hint)
        except ValueError:
            continue

        result = collection.update_one(
            {"username": {"$regex": f"^{normalized['username']}$", "$options": "i"}},
            {
                "$set": normalized,
                "$setOnInsert": {"createdAt": now},
            },
            upsert=True,
        )
        if result.acknowledged:
            imported += 1
            usernames.append(normalized["username"])

    if imported == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No valid scraped influencer documents found",
        )

    invalidate_influencer_cache()
    return InfluencerImportResponse(imported=imported, usernames=usernames)

