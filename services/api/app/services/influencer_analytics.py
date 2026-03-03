from __future__ import annotations

import json
import math
import re
from statistics import median, pstdev
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import parse_qs, quote, urlparse
from urllib.request import Request, urlopen

from app.core.config import get_settings

settings = get_settings()


def to_int(value: Any) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        normalized = value.replace(",", "").strip()
        if not normalized:
            return 0
        try:
            return int(float(normalized))
        except ValueError:
            return 0
    if isinstance(value, dict):
        if "$numberLong" in value:
            return to_int(value.get("$numberLong"))
        if "$numberInt" in value:
            return to_int(value.get("$numberInt"))
    return 0


def to_float(value: Any) -> float:
    if isinstance(value, bool):
        return float(int(value))
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        normalized = value.replace(",", ".").strip()
        if not normalized:
            return 0.0
        try:
            return float(normalized)
        except ValueError:
            return 0.0
    if isinstance(value, dict):
        if "$numberDouble" in value:
            return to_float(value.get("$numberDouble"))
        if "$numberInt" in value:
            return to_float(value.get("$numberInt"))
        if "$numberLong" in value:
            return to_float(value.get("$numberLong"))
    return 0.0


def to_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, (int, float)):
        raw = float(value)
        if raw > 1_000_000_000_000:
            raw = raw / 1000
        try:
            return datetime.fromtimestamp(raw, tz=timezone.utc)
        except (OSError, OverflowError, ValueError):
            return None
    if isinstance(value, str):
        iso_value = value.strip()
        if not iso_value:
            return None
        if iso_value.endswith("Z"):
            iso_value = iso_value[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(iso_value)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    if isinstance(value, dict):
        if "$date" in value:
            return to_datetime(value.get("$date"))
        if "$numberLong" in value:
            return to_datetime(to_int(value.get("$numberLong")))
    return None


def safe_text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized or None


def get_item_list(doc: dict[str, Any]) -> list[dict[str, Any]]:
    data = doc.get("data")
    if isinstance(data, dict):
        items = data.get("itemList")
        if isinstance(items, list):
            return [item for item in items if isinstance(item, dict)]

    raw_payload = doc.get("raw_payload")
    if isinstance(raw_payload, dict):
        raw_data = raw_payload.get("data")
        if isinstance(raw_data, dict):
            items = raw_data.get("itemList")
            if isinstance(items, list):
                return [item for item in items if isinstance(item, dict)]
        raw_items = raw_payload.get("itemList")
        if isinstance(raw_items, list):
            return [item for item in raw_items if isinstance(item, dict)]

    return []


def extract_username(doc: dict[str, Any]) -> str | None:
    for candidate in (
        doc.get("username"),
        doc.get("unique_id"),
        doc.get("uniqueId"),
        doc.get("handle"),
    ):
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()

    for item in get_item_list(doc):
        author = item.get("author")
        if isinstance(author, dict):
            for key in ("uniqueId", "unique_id", "nickname"):
                candidate = author.get(key)
                if isinstance(candidate, str) and candidate.strip():
                    return candidate.strip()
    return None


def _profile_author(items: list[dict[str, Any]]) -> dict[str, Any]:
    if not items:
        return {}
    author = items[0].get("author")
    return author if isinstance(author, dict) else {}


def _profile_stats(doc: dict[str, Any], items: list[dict[str, Any]]) -> dict[str, Any]:
    latest = doc.get("latest")
    if not isinstance(latest, dict):
        latest = {}

    followers = to_int(latest.get("followers"))
    following = to_int(latest.get("following"))
    likes = to_int(latest.get("likes"))
    video_count = to_int(latest.get("videoCount"))

    if followers or following or likes or video_count:
        return {
            "followers": followers,
            "following": following,
            "likes": likes,
            "video_count": video_count,
        }

    author_stats: dict[str, Any] = {}
    if items:
        raw_stats = items[0].get("authorStats")
        if isinstance(raw_stats, dict):
            author_stats = raw_stats

    return {
        "followers": to_int(author_stats.get("followerCount")),
        "following": to_int(author_stats.get("followingCount")),
        "likes": to_int(author_stats.get("heartCount") or author_stats.get("heart")),
        "video_count": to_int(author_stats.get("videoCount")),
    }


def normalize_history(doc: dict[str, Any]) -> list[dict[str, Any]]:
    history = doc.get("history")
    points: list[dict[str, Any]] = []

    if isinstance(history, list):
        for raw in history:
            if not isinstance(raw, dict):
                continue
            points.append(
                {
                    "fetched_at": to_datetime(raw.get("fetchedAt")),
                    "followers": to_int(raw.get("followers")),
                    "following": to_int(raw.get("following")),
                    "likes": to_int(raw.get("likes")),
                    "video_count": to_int(raw.get("videoCount")),
                }
            )

    latest = doc.get("latest")
    if isinstance(latest, dict):
        latest_point = {
            "fetched_at": to_datetime(latest.get("fetchedAt")),
            "followers": to_int(latest.get("followers")),
            "following": to_int(latest.get("following")),
            "likes": to_int(latest.get("likes")),
            "video_count": to_int(latest.get("videoCount")),
        }
        if latest_point not in points:
            points.append(latest_point)

    points.sort(key=lambda point: point.get("fetched_at") or datetime.min.replace(tzinfo=timezone.utc))
    return points


def _video_payload(item: dict[str, Any]) -> dict[str, Any]:
    stats = item.get("stats")
    stats = stats if isinstance(stats, dict) else {}
    video = item.get("video")
    video = video if isinstance(video, dict) else {}

    views = to_int(stats.get("playCount"))
    likes = to_int(stats.get("diggCount"))
    comments = to_int(stats.get("commentCount"))
    shares = to_int(stats.get("shareCount"))
    saves = to_int(stats.get("collectCount"))
    engagement_count = likes + comments + shares + saves
    engagement_rate = round((engagement_count / views) * 100, 2) if views > 0 else 0.0

    return {
        "video_id": str(item.get("id") or ""),
        "description": str(item.get("desc") or ""),
        "subtitle": safe_text(item.get("subtitle")),
        "cover_url": _extract_video_cover_url(item, video),
        "create_time": to_datetime(item.get("createTime")),
        "duration": to_int(video.get("duration")),
        "views": views,
        "likes": likes,
        "comments": comments,
        "shares": shares,
        "saves": saves,
        "engagement_count": engagement_count,
        "engagement_rate": engagement_rate,
        "is_pinned": bool(item.get("isPinnedItem", False)),
    }


def _first_non_empty_url(value: Any) -> str | None:
    if isinstance(value, str):
        normalized = value.strip()
        return normalized or None

    if isinstance(value, list):
        for entry in value:
            url = _first_non_empty_url(entry)
            if url:
                return url
        return None

    if isinstance(value, dict):
        for key in ("urlList", "url_list", "url"):
            if key in value:
                url = _first_non_empty_url(value.get(key))
                if url:
                    return url
        return None

    return None


def _extract_video_cover_url(item: dict[str, Any], video: dict[str, Any]) -> str | None:
    for candidate in (
        video.get("cover"),
        video.get("originCover"),
        video.get("dynamicCover"),
        item.get("videoCover"),
        item.get("cover"),
        item.get("originCover"),
        item.get("dynamicCover"),
    ):
        cover_url = _first_non_empty_url(candidate)
        if cover_url:
            return cover_url
    return None


_COVER_CACHE_TTL_SECONDS = settings.cover_cache_ttl_seconds
_COVER_URL_CACHE: dict[str, dict[str, Any]] = {}
_UNIVERSAL_DATA_PATTERN = re.compile(
    r'<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">(.*?)</script>',
    re.S,
)


def _is_cover_url_expired(url: str | None) -> bool:
    if not isinstance(url, str) or not url.strip():
        return True

    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    expires_values = query.get("x-expires")
    if not expires_values:
        return False

    try:
        expires_at = int(expires_values[0])
    except (TypeError, ValueError):
        return False

    return expires_at <= int(datetime.now(timezone.utc).timestamp())


def _cache_get_cover(video_id: str) -> str | None:
    cache_entry = _COVER_URL_CACHE.get(video_id)
    if not cache_entry:
        return None

    expires_at = cache_entry.get("expires_at")
    if not isinstance(expires_at, datetime) or expires_at <= datetime.now(timezone.utc):
        _COVER_URL_CACHE.pop(video_id, None)
        return None

    cover_url = cache_entry.get("cover_url")
    if isinstance(cover_url, str) and cover_url.strip():
        return cover_url

    return None


def _cache_set_cover(video_id: str, cover_url: str | None) -> None:
    if not isinstance(cover_url, str) or not cover_url.strip():
        return

    expires_at = datetime.now(timezone.utc) + timedelta(seconds=_COVER_CACHE_TTL_SECONDS)
    parsed = urlparse(cover_url)
    query = parse_qs(parsed.query)
    expires_values = query.get("x-expires")
    if expires_values:
        try:
            signed_exp = datetime.fromtimestamp(int(expires_values[0]), tz=timezone.utc)
            expires_at = min(expires_at, signed_exp)
        except (TypeError, ValueError, OSError):
            pass

    _COVER_URL_CACHE[video_id] = {"cover_url": cover_url, "expires_at": expires_at}


def _extract_cover_from_universal_data(raw_json: str, video_id: str) -> str | None:
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError:
        return None

    candidates: list[str] = []

    def collect_from_video(video_block: Any) -> None:
        if not isinstance(video_block, dict):
            return
        for key in ("cover", "originCover", "dynamicCover"):
            value = video_block.get(key)
            if isinstance(value, str) and value.strip():
                candidates.append(value.strip())
        zoom_cover = video_block.get("zoomCover")
        if isinstance(zoom_cover, dict):
            for size in ("720", "480", "960", "240"):
                value = zoom_cover.get(size)
                if isinstance(value, str) and value.strip():
                    candidates.append(value.strip())

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            node_id = node.get("id")
            if isinstance(node_id, str) and node_id == video_id:
                collect_from_video(node.get("video"))
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(data)
    for candidate in candidates:
        if not _is_cover_url_expired(candidate):
            return candidate

    return candidates[0] if candidates else None


def _fetch_fresh_cover_url(username: str, video_id: str) -> str | None:
    cached = _cache_get_cover(video_id)
    if cached and not _is_cover_url_expired(cached):
        return cached

    video_url = f"https://www.tiktok.com/@{quote(username)}/video/{quote(video_id)}"
    request = Request(
        video_url,
        headers={
            "User-Agent": settings.cover_fetch_user_agent,
            "Accept-Language": settings.cover_fetch_accept_language,
        },
    )

    try:
        with urlopen(request, timeout=settings.cover_fetch_timeout_seconds) as response:
            html = response.read().decode("utf-8", "ignore")
    except Exception:
        return None

    match = _UNIVERSAL_DATA_PATTERN.search(html)
    if not match:
        return None

    cover_url = _extract_cover_from_universal_data(match.group(1), video_id)
    _cache_set_cover(video_id, cover_url)
    return cover_url


def _refresh_cover_urls(
    username: str,
    videos: list[dict[str, Any]],
    resolved_by_video_id: dict[str, str | None],
    fetch_budget: int,
) -> tuple[list[dict[str, Any]], int]:
    refreshed: list[dict[str, Any]] = []

    for video in videos:
        video_id = str(video.get("video_id") or "")
        current_cover = video.get("cover_url")

        if not video_id:
            refreshed.append(video)
            continue

        if video_id in resolved_by_video_id:
            next_cover = resolved_by_video_id[video_id]
        else:
            next_cover = current_cover if isinstance(current_cover, str) and current_cover.strip() else None
            if _is_cover_url_expired(next_cover) and fetch_budget > 0:
                fetched = _fetch_fresh_cover_url(username, video_id)
                if fetched:
                    next_cover = fetched
                fetch_budget -= 1
            resolved_by_video_id[video_id] = next_cover

        next_video = dict(video)
        next_video["cover_url"] = next_cover
        refreshed.append(next_video)

    return refreshed, fetch_budget


def video_metrics(items: list[dict[str, Any]]) -> dict[str, Any]:
    videos = [_video_payload(item) for item in items]
    total_views = sum(video["views"] for video in videos)
    total_likes = sum(video["likes"] for video in videos)
    total_comments = sum(video["comments"] for video in videos)
    total_shares = sum(video["shares"] for video in videos)
    total_saves = sum(video["saves"] for video in videos)
    total_engagement = total_likes + total_comments + total_shares + total_saves
    average_views = round(total_views / len(videos), 2) if videos else 0.0
    engagement_rate = round((total_engagement / total_views) * 100, 2) if total_views > 0 else 0.0
    top_videos = sorted(videos, key=lambda video: video["views"], reverse=True)
    recent_videos = sorted(
        videos,
        key=lambda video: video["create_time"] or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )

    latest_video_at = None
    if recent_videos:
        latest_video_at = recent_videos[0].get("create_time")

    return {
        "videos": videos,
        "top_videos": top_videos,
        "recent_videos": recent_videos,
        "total_views": total_views,
        "total_likes": total_likes,
        "total_comments": total_comments,
        "total_shares": total_shares,
        "total_saves": total_saves,
        "total_engagement": total_engagement,
        "average_views": average_views,
        "engagement_rate": engagement_rate,
        "scraped_video_count": len(videos),
        "latest_video_at": latest_video_at,
    }


def lightweight_video_metrics(items: list[dict[str, Any]]) -> dict[str, Any]:
    total_views = 0
    total_likes = 0
    total_comments = 0
    total_shares = 0
    total_saves = 0
    latest_video_at = None
    scraped_video_count = 0

    for item in items:
        stats = item.get("stats")
        stats = stats if isinstance(stats, dict) else {}
        views = to_int(stats.get("playCount"))
        likes = to_int(stats.get("diggCount"))
        comments = to_int(stats.get("commentCount"))
        shares = to_int(stats.get("shareCount"))
        saves = to_int(stats.get("collectCount"))

        total_views += views
        total_likes += likes
        total_comments += comments
        total_shares += shares
        total_saves += saves
        scraped_video_count += 1

        create_time = to_datetime(item.get("createTime"))
        if create_time and (latest_video_at is None or create_time > latest_video_at):
            latest_video_at = create_time

    total_engagement = total_likes + total_comments + total_shares + total_saves
    average_views = round(total_views / scraped_video_count, 2) if scraped_video_count > 0 else 0.0
    engagement_rate = round((total_engagement / total_views) * 100, 2) if total_views > 0 else 0.0

    return {
        "total_views": total_views,
        "average_views": average_views,
        "engagement_rate": engagement_rate,
        "scraped_video_count": scraped_video_count,
        "latest_video_at": latest_video_at,
    }


def build_influencer_summary(doc: dict[str, Any]) -> dict[str, Any]:
    username = extract_username(doc) or "unknown"
    items = get_item_list(doc)
    author = _profile_author(items)
    profile_stats = _profile_stats(doc, items)
    history = normalize_history(doc)
    metrics = lightweight_video_metrics(items)
    fetched_at = (
        to_datetime(doc.get("fetchedAt"))
        or to_datetime((doc.get("latest") or {}).get("fetchedAt"))
        or to_datetime(doc.get("updated_at"))
    )

    return {
        "id": str(doc.get("_id", "")),
        "username": username,
        "nickname": safe_text(author.get("nickname")),
        "avatar_url": safe_text(author.get("avatarMedium") or author.get("avatarThumb")),
        "verified": bool(author.get("verified", False)),
        "followers": profile_stats["followers"],
        "following": profile_stats["following"],
        "likes": profile_stats["likes"],
        "profile_video_count": profile_stats["video_count"],
        "scraped_video_count": metrics["scraped_video_count"],
        "total_views": metrics["total_views"],
        "average_views": metrics["average_views"],
        "engagement_rate": metrics["engagement_rate"],
        "fetched_at": fetched_at,
        "latest_video_at": metrics["latest_video_at"],
        "history_points": len(history),
        "domain": safe_text(doc.get("domain")),
        "domain_confidence": round(max(to_float(doc.get("domain_confidence")), 0.0), 2),
    }


def build_influencer_detail(doc: dict[str, Any]) -> dict[str, Any]:
    summary = build_influencer_summary(doc)
    items = get_item_list(doc)
    author = _profile_author(items)
    history = normalize_history(doc)
    metrics = video_metrics(items)

    growth_followers = 0
    growth_likes = 0
    if len(history) >= 2:
        growth_followers = history[-1]["followers"] - history[0]["followers"]
        growth_likes = history[-1]["likes"] - history[0]["likes"]

    # Some stored TikTok signed cover URLs expire quickly; refresh them on demand.
    resolved_by_video_id: dict[str, str | None] = {}
    fetch_budget = settings.cover_fetch_budget
    top_videos, fetch_budget = _refresh_cover_urls(
        summary["username"],
        metrics["top_videos"],
        resolved_by_video_id,
        fetch_budget,
    )
    recent_videos, _ = _refresh_cover_urls(
        summary["username"],
        metrics["recent_videos"],
        resolved_by_video_id,
        fetch_budget,
    )

    return {
        **summary,
        "bio": safe_text(author.get("signature")),
        "top_videos": top_videos,
        "recent_videos": recent_videos,
        "history": history,
        "growth_followers": growth_followers,
        "growth_likes": growth_likes,
    }


def build_dashboard_overview(summaries: list[dict[str, Any]]) -> dict[str, Any]:
    if not summaries:
        return {
            "total_influencers": 0,
            "total_followers": 0,
            "total_profile_likes": 0,
            "total_profile_videos": 0,
            "total_scraped_videos": 0,
            "total_views": 0,
            "average_engagement_rate": 0.0,
            "recently_updated": 0,
            "top_by_followers": None,
            "top_by_views": None,
        }

    now = datetime.now(timezone.utc)
    total_followers = sum(item["followers"] for item in summaries)
    total_profile_likes = sum(item["likes"] for item in summaries)
    total_profile_videos = sum(item["profile_video_count"] for item in summaries)
    total_scraped_videos = sum(item["scraped_video_count"] for item in summaries)
    total_views = sum(item["total_views"] for item in summaries)
    average_engagement_rate = round(
        sum(item["engagement_rate"] for item in summaries) / len(summaries), 2
    )
    recently_updated = sum(
        1
        for item in summaries
        if item.get("fetched_at") and (now - item["fetched_at"]).days <= settings.dashboard_recently_updated_days
    )

    top_by_followers = max(summaries, key=lambda item: item["followers"])
    top_by_views = max(summaries, key=lambda item: item["total_views"])

    return {
        "total_influencers": len(summaries),
        "total_followers": total_followers,
        "total_profile_likes": total_profile_likes,
        "total_profile_videos": total_profile_videos,
        "total_scraped_videos": total_scraped_videos,
        "total_views": total_views,
        "average_engagement_rate": average_engagement_rate,
        "recently_updated": recently_updated,
        "top_by_followers": top_by_followers,
        "top_by_views": top_by_views,
    }


def normalize_scraped_document(document: dict[str, Any]) -> dict[str, Any]:
    doc = dict(document)
    doc.pop("_id", None)

    username = extract_username(doc)
    if not username:
        raise ValueError("username not found in scraped document")

    return normalize_scraped_document_with_source(doc, source=doc.get("source"))


def normalize_scraped_document_with_source(document: dict[str, Any], source: Any | None) -> dict[str, Any]:
    doc = dict(document)
    doc.pop("_id", None)

    username = extract_username(doc)
    if not username:
        raise ValueError("username not found in scraped document")

    now = datetime.now(timezone.utc)
    latest = doc.get("latest")
    latest = latest if isinstance(latest, dict) else {}
    history_raw = doc.get("history")
    history = [item for item in history_raw if isinstance(item, dict)] if isinstance(history_raw, list) else []

    data = doc.get("data")
    if not isinstance(data, dict):
        data = {}
    if not isinstance(data.get("itemList"), list):
        item_list = doc.get("itemList")
        if isinstance(item_list, list):
            data = dict(data)
            data["itemList"] = [item for item in item_list if isinstance(item, dict)]

    fetched_at = to_datetime(doc.get("fetchedAt")) or to_datetime(latest.get("fetchedAt")) or now

    source_text = str(source or "").strip().lower()
    normalized_source = "saas" if source_text == "saas" else "extension"

    # Keep the same storage model as extension backend, with a single extra field: source.
    return {
        "username": username,
        "data": data,
        "latest": latest,
        "history": history,
        "fetchedAt": fetched_at,
        "source": normalized_source,
    }


def top_videos(
    docs: list[dict[str, Any]],
    limit: int = settings.insights_top_videos_default_limit,
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []

    for doc in docs:
        summary = build_influencer_summary(doc)
        username = summary["username"]
        nickname = summary.get("nickname")
        videos = video_metrics(get_item_list(doc))["videos"]

        for video in videos:
            items.append(
                {
                    "influencer_username": username,
                    "influencer_nickname": nickname,
                    "video_id": video["video_id"],
                    "description": video["description"],
                    "create_time": video["create_time"],
                    "views": video["views"],
                    "likes": video["likes"],
                    "comments": video["comments"],
                    "shares": video["shares"],
                    "engagement_rate": video["engagement_rate"],
                }
            )

    items.sort(key=lambda item: item["views"], reverse=True)
    return items[:limit]


def _pick_growth_points(
    history: list[dict[str, Any]],
    reference_days: int,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if not history:
        return None, None

    now_point = history[-1]
    now_date = now_point.get("fetched_at")
    if not isinstance(now_date, datetime):
        return None, None

    target_date = now_date - timedelta(days=reference_days)
    baseline = None
    for point in reversed(history[:-1]):
        point_date = point.get("fetched_at")
        if isinstance(point_date, datetime) and point_date <= target_date:
            baseline = point
            break

    if baseline is None and len(history) >= 2:
        baseline = history[0]

    return now_point, baseline


def top_growth(
    docs: list[dict[str, Any]],
    reference_days: int = settings.insights_top_growth_default_days,
    limit: int = settings.insights_top_growth_default_limit,
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []

    for doc in docs:
        summary = build_influencer_summary(doc)
        history = normalize_history(doc)
        current, baseline = _pick_growth_points(history, reference_days)
        if not current or not baseline:
            continue

        followers_now = to_int(current.get("followers"))
        followers_then = to_int(baseline.get("followers"))
        growth_abs = followers_now - followers_then
        if growth_abs <= 0:
            continue

        growth_percent = round((growth_abs / max(followers_then, 1)) * 100, 2)

        results.append(
            {
                "username": summary["username"],
                "nickname": summary.get("nickname"),
                "followers_now": followers_now,
                "followers_then": followers_then,
                "growth_abs": growth_abs,
                "growth_percent": growth_percent,
                "reference_days": reference_days,
                "fetched_at_now": current.get("fetched_at"),
                "fetched_at_then": baseline.get("fetched_at"),
            }
        )

    results.sort(key=lambda item: (item["growth_abs"], item["growth_percent"]), reverse=True)
    return results[:limit]


def original_ideas(summaries: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    # Rising stars: medium followers + high growth potential via engagement/views ratio.
    rising_stars = [
        item
        for item in summaries
        if settings.ideas_rising_min_followers <= item["followers"] <= settings.ideas_rising_max_followers
        and item["engagement_rate"] >= settings.ideas_rising_min_engagement_rate
    ]
    rising_stars.sort(
        key=lambda item: (item["engagement_rate"], item["average_views"], item["followers"]),
        reverse=True,
    )

    # Undervalued: low followers but strong average views and engagement.
    undervalued = [
        item
        for item in summaries
        if item["followers"] <= settings.ideas_undervalued_max_followers
        and item["average_views"] >= settings.ideas_undervalued_min_average_views
        and item["engagement_rate"] >= settings.ideas_undervalued_min_engagement_rate
    ]
    undervalued.sort(
        key=lambda item: (item["engagement_rate"], item["average_views"]),
        reverse=True,
    )

    return {
        "rising_stars": rising_stars[:settings.ideas_result_limit],
        "undervalued_creators": undervalued[:settings.ideas_result_limit],
    }


def _clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, value))


def _safe_mean(values: list[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)


def _video_rows(doc: dict[str, Any], now: datetime) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in get_item_list(doc):
        stats = item.get("stats")
        stats = stats if isinstance(stats, dict) else {}
        create_time = to_datetime(item.get("createTime"))
        views = to_int(stats.get("playCount"))
        likes = to_int(stats.get("diggCount"))
        comments = to_int(stats.get("commentCount"))
        shares = to_int(stats.get("shareCount"))
        saves = to_int(stats.get("collectCount"))
        weighted_engagement = (
            likes
            + (settings.metrics_weighted_engagement_comment_multiplier * comments)
            + (settings.metrics_weighted_engagement_share_multiplier * shares)
            + (settings.metrics_weighted_engagement_save_multiplier * saves)
        )
        age_days = None
        if isinstance(create_time, datetime):
            age_days = max((now - create_time).total_seconds() / 86400.0, settings.metrics_min_age_days)

        rows.append(
            {
                "create_time": create_time,
                "views": views,
                "likes": likes,
                "comments": comments,
                "shares": shares,
                "saves": saves,
                "weighted_engagement": weighted_engagement,
                "engagement": likes + comments + shares + saves,
                "age_days": age_days,
            }
        )
    return rows


def _rows_within_days(rows: list[dict[str, Any]], days: int, now: datetime) -> list[dict[str, Any]]:
    cutoff = now - timedelta(days=days)
    return [
        row
        for row in rows
        if isinstance(row.get("create_time"), datetime) and row["create_time"] >= cutoff
    ]


def _growth_snapshot(history: list[dict[str, Any]], days: int) -> dict[str, float]:
    current, baseline = _pick_growth_points(history, days)
    if not current or not baseline:
        return {"abs": 0.0, "percent": 0.0, "velocity": 0.0}

    current_dt = current.get("fetched_at")
    baseline_dt = baseline.get("fetched_at")
    if not isinstance(current_dt, datetime) or not isinstance(baseline_dt, datetime):
        return {"abs": 0.0, "percent": 0.0, "velocity": 0.0}

    followers_now = to_int(current.get("followers"))
    followers_then = to_int(baseline.get("followers"))
    growth_abs = float(followers_now - followers_then)
    span_days = max((current_dt - baseline_dt).total_seconds() / 86400.0, 1.0)
    growth_percent = (growth_abs / max(followers_then, 1)) * 100.0
    velocity = growth_abs / span_days
    return {"abs": growth_abs, "percent": growth_percent, "velocity": velocity}


def _compute_advanced_metric_row(doc: dict[str, Any], now: datetime) -> dict[str, Any]:
    summary = build_influencer_summary(doc)
    history = normalize_history(doc)
    rows = _video_rows(doc, now)

    short_window_days = max(settings.metrics_window_short_days, 1)
    medium_window_days = max(settings.metrics_window_medium_days, 1)
    long_window_days = max(settings.metrics_window_long_days, 1)

    rows_7d = _rows_within_days(rows, short_window_days, now)
    rows_30d = _rows_within_days(rows, medium_window_days, now)
    rows_90d = _rows_within_days(rows, long_window_days, now)
    rows_old = [
        row
        for row in rows
        if isinstance(row.get("age_days"), float) and row["age_days"] > medium_window_days
    ]

    growth_7d = _growth_snapshot(history, short_window_days)
    growth_30d = _growth_snapshot(history, medium_window_days)
    velocity_7d = growth_7d["velocity"]
    velocity_30d = growth_30d["velocity"]
    growth_acceleration = velocity_7d - velocity_30d

    followers_now = max(summary["followers"], 1)
    avg_views_30d = _safe_mean([float(row["views"]) for row in rows_30d])
    reach_efficiency = avg_views_30d / followers_now

    weighted_30d = sum(to_int(row["weighted_engagement"]) for row in rows_30d)
    views_30d = sum(to_int(row["views"]) for row in rows_30d)
    engagement_quality_score = (weighted_30d / max(views_30d, 1)) * 100.0

    frequency_score = _clamp((len(rows_30d) / max(float(medium_window_days), 1.0)) * 100.0)
    regularity_score = 0.0
    dated_rows_30d = [row for row in rows_30d if isinstance(row.get("create_time"), datetime)]
    dated_rows_30d.sort(key=lambda row: row["create_time"])
    if len(dated_rows_30d) >= 3:
        gaps: list[float] = []
        for idx in range(1, len(dated_rows_30d)):
            gap = (
                dated_rows_30d[idx]["create_time"] - dated_rows_30d[idx - 1]["create_time"]
            ).total_seconds() / 86400.0
            gaps.append(max(gap, 0.0))

        avg_gap = _safe_mean(gaps)
        std_gap = pstdev(gaps) if len(gaps) > 1 else 0.0
        if avg_gap > 0:
            regularity_score = _clamp(
                100.0 - ((std_gap / avg_gap) * settings.metrics_regularity_penalty_factor)
            )
    elif len(dated_rows_30d) >= 2:
        regularity_score = settings.metrics_regularity_two_posts_score

    consistency_score = _clamp(
        (settings.metrics_consistency_frequency_weight * frequency_score)
        + (settings.metrics_consistency_regularity_weight * regularity_score)
    )

    views_for_viral = [to_int(row["views"]) for row in rows_90d if to_int(row["views"]) > 0]
    if len(views_for_viral) >= 3:
        baseline_views = max(float(median(views_for_viral)), 1.0)
        viral_threshold = baseline_views * settings.metrics_viral_threshold_multiplier
        viral_hits = sum(1 for value in views_for_viral if value >= viral_threshold)
        viral_hit_rate = (viral_hits / len(views_for_viral)) * 100.0
    else:
        viral_hit_rate = 0.0

    fresh_rates: list[float] = []
    for row in rows_7d:
        age_days = row.get("age_days")
        if not isinstance(age_days, float):
            continue
        fresh_rates.append(to_int(row["views"]) / max(age_days, settings.metrics_min_age_days))
    fresh_content_power = _safe_mean(fresh_rates)

    all_vpd = [
        (to_int(row["views"]) / max(row["age_days"], settings.metrics_min_age_days))
        for row in rows
        if isinstance(row.get("age_days"), float)
    ]
    old_vpd = [
        (to_int(row["views"]) / max(row["age_days"], settings.metrics_min_age_days))
        for row in rows_old
        if isinstance(row.get("age_days"), float)
    ]
    evergreen_index = 0.0
    if old_vpd and all_vpd:
        global_median = float(median(all_vpd))
        evergreen_hits = sum(1 for value in old_vpd if value >= global_median)
        evergreen_index = (evergreen_hits / len(old_vpd)) * 100.0

    engagement_30d = sum(to_int(row["engagement"]) for row in rows_30d)
    audience_conversion_proxy = (growth_30d["abs"] / max(engagement_30d, 1)) * 1000.0

    views_volatility_score = 0.0
    if len(views_for_viral) >= 3:
        mean_views = _safe_mean([float(value) for value in views_for_viral])
        if mean_views > 0:
            volatility = pstdev(views_for_viral) / mean_views
            views_volatility_score = _clamp(
                volatility * settings.metrics_views_volatility_factor,
                0.0,
                settings.metrics_views_volatility_cap,
            )

    engagement_7d = sum(to_int(row["engagement"]) for row in rows_7d)
    spike_risk = 0.0
    if growth_7d["abs"] > 0:
        engagement_per_new_follower = engagement_7d / max(growth_7d["abs"], 1.0)
        if engagement_per_new_follower < settings.metrics_spike_risk_threshold_low:
            spike_risk = settings.metrics_spike_risk_score_low
        elif engagement_per_new_follower < settings.metrics_spike_risk_threshold_mid:
            spike_risk = settings.metrics_spike_risk_score_mid
        elif engagement_per_new_follower < settings.metrics_spike_risk_threshold_high:
            spike_risk = settings.metrics_spike_risk_score_high

    stability_risk_score = _clamp(views_volatility_score + spike_risk)

    growth_score = _clamp(growth_30d["percent"] * settings.metrics_growth_score_multiplier)
    brandability_score = _clamp(
        (settings.metrics_brandability_weight_engagement * _clamp(engagement_quality_score))
        + (settings.metrics_brandability_weight_consistency * consistency_score)
        + (settings.metrics_brandability_weight_stability * (100.0 - stability_risk_score))
        + (settings.metrics_brandability_weight_growth * growth_score)
    )

    accel_ratio = (growth_acceleration / max(followers_now, 1)) * settings.metrics_acceleration_ratio_scale
    acceleration_score = _clamp(accel_ratio * settings.metrics_acceleration_score_multiplier)
    fresh_score = _clamp(
        (
            math.log1p(max(fresh_content_power, 0.0))
            / math.log1p(max(settings.metrics_fresh_score_log_cap, 1.0))
        )
        * 100.0
    )
    breakout_score = _clamp(
        (settings.metrics_breakout_weight_acceleration * acceleration_score)
        + (settings.metrics_breakout_weight_fresh * fresh_score)
        + (settings.metrics_breakout_weight_viral * viral_hit_rate)
    )

    return {
        "username": summary["username"],
        "nickname": summary.get("nickname"),
        "followers": summary["followers"],
        "fetched_at": summary.get("fetched_at"),
        "growth_velocity_7d": round(velocity_7d, 2),
        "growth_velocity_30d": round(velocity_30d, 2),
        "growth_acceleration": round(growth_acceleration, 2),
        "reach_efficiency": round(reach_efficiency, 4),
        "engagement_quality_score": round(_clamp(engagement_quality_score), 2),
        "consistency_score": round(consistency_score, 2),
        "viral_hit_rate": round(_clamp(viral_hit_rate), 2),
        "fresh_content_power": round(max(fresh_content_power, 0.0), 2),
        "evergreen_index": round(_clamp(evergreen_index), 2),
        "audience_conversion_proxy": round(audience_conversion_proxy, 4),
        "stability_risk_score": round(stability_risk_score, 2),
        "brandability_score": round(brandability_score, 2),
        "breakout_score": round(breakout_score, 2),
    }


def advanced_metrics(
    docs: list[dict[str, Any]],
    limit: int = settings.insights_advanced_metrics_default_limit,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    metric_rows = [_compute_advanced_metric_row(doc, now) for doc in docs]

    sort_keys = (
        "growth_velocity_7d",
        "growth_velocity_30d",
        "growth_acceleration",
        "reach_efficiency",
        "engagement_quality_score",
        "consistency_score",
        "viral_hit_rate",
        "fresh_content_power",
        "evergreen_index",
        "audience_conversion_proxy",
        "stability_risk_score",
        "brandability_score",
        "breakout_score",
    )

    leaders: dict[str, list[dict[str, Any]]] = {}
    for key in sort_keys:
        ranked = sorted(metric_rows, key=lambda row: row.get(key, 0.0), reverse=True)
        leaders[key] = ranked[:limit]

    return {
        "generated_at": now,
        "leaders": leaders,
    }
