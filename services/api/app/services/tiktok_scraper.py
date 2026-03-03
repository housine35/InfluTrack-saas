from __future__ import annotations

import asyncio
import base64
import html
import json
import os
import random
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import parse_qs, quote, urlparse
from urllib.request import Request, urlopen

from app.core.config import get_settings
from app.db.mongodb import get_influencers_collection
from app.services.influencer_analytics import normalize_scraped_document_with_source

try:
    from pydoll.browser import Chrome
    from pydoll.browser.options import ChromiumOptions
    from pydoll.protocol.network.events import NetworkEvent

    _PYDOLL_AVAILABLE = True
except Exception:
    Chrome = None  # type: ignore[assignment]
    ChromiumOptions = None  # type: ignore[assignment]
    NetworkEvent = None  # type: ignore[assignment]
    _PYDOLL_AVAILABLE = False


_SUBTITLE_TIMESTAMP_RE = re.compile(
    r"^\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}"
)
_SUBTITLE_HTML_TAG_RE = re.compile(r"<[^>]+>")
_SUBTITLE_ENRICHMENT_INFLIGHT: set[str] = set()
_SUBTITLE_ENRICHMENT_LOCK = asyncio.Lock()


def _to_int(value: Any) -> int:
    if value is None:
        return 0
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        cleaned = "".join(char for char in value if char.isdigit())
        return int(cleaned) if cleaned else 0
    return 0


def _normalize_username(value: str) -> str:
    return value.strip().lstrip("@")


def _normalize_item_id(item: dict[str, Any]) -> str | None:
    item_id = item.get("id")
    if item_id is None:
        return None
    normalized = str(item_id).strip()
    return normalized or None


def _merge_item_lists_by_id(
    existing_items: list[dict[str, Any]],
    incoming_items: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], int, int]:
    by_id: dict[str, dict[str, Any]] = {}
    no_id_items: list[dict[str, Any]] = []
    no_id_signatures: set[tuple[int, str, str]] = set()
    new_count = 0
    updated_count = 0

    def add_no_id(item: dict[str, Any]) -> None:
        author = item.get("author")
        author = author if isinstance(author, dict) else {}
        signature = (
            _to_int(item.get("createTime")),
            str(item.get("desc") or "").strip(),
            str(author.get("id") or "").strip(),
        )
        if signature in no_id_signatures:
            return
        no_id_signatures.add(signature)
        no_id_items.append(item)

    for item in existing_items:
        item_id = _normalize_item_id(item)
        if item_id:
            by_id[item_id] = item
        else:
            add_no_id(item)

    for item in incoming_items:
        item_id = _normalize_item_id(item)
        if item_id:
            if item_id in by_id:
                updated_count += 1
                existing_item = by_id[item_id]
                existing_subtitle = ""
                if isinstance(existing_item, dict):
                    existing_subtitle = str(existing_item.get("subtitle") or "").strip()
                    merged_item = dict(existing_item)
                else:
                    merged_item = {}
                merged_item.update(item)
                incoming_subtitle = str(item.get("subtitle") or "").strip()
                if existing_subtitle and not incoming_subtitle:
                    merged_item["subtitle"] = existing_subtitle
                by_id[item_id] = merged_item
            else:
                new_count += 1
                by_id[item_id] = item
        else:
            add_no_id(item)

    merged = list(by_id.values()) + no_id_items
    merged.sort(key=lambda row: _to_int(row.get("createTime")), reverse=True)
    return merged, new_count, updated_count


def _resolve_browser_binary() -> str | None:
    settings = get_settings()
    candidates = [
        settings.tiktok_scraper_chrome_bin,
        os.getenv("CHROME_BIN"),
        os.getenv("CHROMIUM_BIN"),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
    ]
    for path in candidates:
        if path and os.path.exists(path):
            return path
    return None


def _has_non_empty_query_param(url: str, name: str) -> bool:
    values = parse_qs(urlparse(url).query).get(name)
    if not values:
        return False
    return bool(str(values[0]).strip())


def _pick_proxy() -> str | None:
    settings = get_settings()
    base = settings.tiktok_scraper_proxy_base.strip()
    if not base:
        return None
    ports = [
        port.strip()
        for port in settings.tiktok_scraper_proxy_ports.split(",")
        if port.strip()
    ]
    if not ports:
        return None
    return f"{base}:{random.choice(ports)}"


async def _get_response_body_with_retry(tab: Any, request_id: str) -> str:
    settings = get_settings()
    attempts = max(settings.tiktok_scraper_response_retry_attempts, 1)
    delay = max(settings.tiktok_scraper_response_retry_delay_seconds, 0.1)

    for _ in range(attempts):
        try:
            raw = await tab.get_network_response_body(request_id)
            body = ""
            if isinstance(raw, dict):
                body = raw.get("body", "") or ""
                if raw.get("base64Encoded") and body:
                    body = base64.b64decode(body).decode("utf-8", errors="ignore")
            elif isinstance(raw, str):
                body = raw

            if body.strip():
                return body
        except Exception:
            pass
        await asyncio.sleep(delay)

    return ""

def _append_url_candidates(raw: Any, urls: list[str], seen: set[str]) -> None:
    if isinstance(raw, str):
        candidate = raw.strip()
        if candidate.startswith("http") and candidate not in seen:
            seen.add(candidate)
            urls.append(candidate)
        return

    if isinstance(raw, list):
        for entry in raw:
            _append_url_candidates(entry, urls, seen)
        return

    if isinstance(raw, dict):
        for key in ("url", "Url", "urlList", "UrlList"):
            if key in raw:
                _append_url_candidates(raw.get(key), urls, seen)


def _extract_subtitle_urls_from_item(item: dict[str, Any]) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()

    video = item.get("video")
    video = video if isinstance(video, dict) else {}

    subtitle_infos = item.get("subtitleInfos")
    if isinstance(subtitle_infos, list):
        for subtitle_info in subtitle_infos:
            _append_url_candidates(subtitle_info, urls, seen)

    video_subtitle_infos = video.get("subtitleInfos")
    if isinstance(video_subtitle_infos, list):
        for subtitle_info in video_subtitle_infos:
            _append_url_candidates(subtitle_info, urls, seen)

    cla_info = item.get("claInfo")
    cla_info = cla_info if isinstance(cla_info, dict) else {}
    caption_infos = cla_info.get("captionInfos")
    if isinstance(caption_infos, list):
        for caption_info in caption_infos:
            _append_url_candidates(caption_info, urls, seen)

    video_cla_info = video.get("claInfo")
    video_cla_info = video_cla_info if isinstance(video_cla_info, dict) else {}
    video_caption_infos = video_cla_info.get("captionInfos")
    if isinstance(video_caption_infos, list):
        for caption_info in video_caption_infos:
            _append_url_candidates(caption_info, urls, seen)

    return urls


def _collect_text_from_json(node: Any, out: list[str]) -> None:
    if isinstance(node, str):
        text = node.strip()
        if text:
            out.append(text)
        return

    if isinstance(node, list):
        for entry in node:
            _collect_text_from_json(entry, out)
        return

    if isinstance(node, dict):
        # Prioritize common subtitle keys.
        for key in (
            "text",
            "utf8",
            "content",
            "caption",
            "captions",
            "line",
            "lines",
            "value",
        ):
            if key in node:
                _collect_text_from_json(node.get(key), out)

        for value in node.values():
            if isinstance(value, (dict, list)):
                _collect_text_from_json(value, out)


def _parse_subtitle_payload(payload: str) -> str:
    raw = payload.strip()
    if not raw:
        return ""

    json_lines: list[str] = []
    try:
        parsed = json.loads(raw)
        _collect_text_from_json(parsed, json_lines)
    except json.JSONDecodeError:
        pass

    if json_lines:
        cleaned_json_lines: list[str] = []
        previous = ""
        for line in json_lines:
            clean = _SUBTITLE_HTML_TAG_RE.sub("", html.unescape(line)).strip()
            if not clean or clean == previous:
                continue
            previous = clean
            cleaned_json_lines.append(clean)
        joined = " ".join(cleaned_json_lines).strip()
        return joined

    lines = raw.splitlines()
    spoken_lines: list[str] = []
    previous = ""
    for line in lines:
        clean = line.strip()
        if not clean:
            continue
        upper = clean.upper()
        if upper.startswith("WEBVTT") or upper.startswith("NOTE"):
            continue
        if clean.isdigit():
            continue
        if _SUBTITLE_TIMESTAMP_RE.match(clean) or "-->" in clean:
            continue
        clean = _SUBTITLE_HTML_TAG_RE.sub("", html.unescape(clean)).strip()
        if not clean or clean == previous:
            continue
        previous = clean
        spoken_lines.append(clean)

    return " ".join(spoken_lines).strip()


def _fetch_subtitle_text(url: str) -> str:
    settings = get_settings()
    timeout_seconds = max(settings.tiktok_subtitle_fetch_timeout_seconds, 1)
    user_agent = settings.tiktok_subtitle_user_agent.strip() or settings.cover_fetch_user_agent
    max_chars = max(settings.tiktok_subtitle_max_chars_per_video, 200)

    request = Request(
        url,
        headers={
            "User-Agent": user_agent,
            "Accept-Language": settings.cover_fetch_accept_language,
        },
    )

    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            body = response.read().decode("utf-8", errors="ignore")
    except Exception:
        return ""

    parsed = _parse_subtitle_payload(body)
    if not parsed:
        return ""

    if len(parsed) > max_chars:
        return parsed[:max_chars].rstrip()
    return parsed

def _invalidate_influencer_cache_safely() -> None:
    try:
        from app.api.routes_influencers import invalidate_influencer_cache

        invalidate_influencer_cache()
    except Exception:
        # Background enrichment must never fail on cache invalidation.
        pass


def _run_subtitle_enrichment_sync(username: str) -> None:
    settings = get_settings()
    collection = get_influencers_collection()
    existing_doc = _find_existing_doc(username)
    if not existing_doc:
        return

    doc_id = existing_doc.get("_id")
    data = existing_doc.get("data")
    data = data if isinstance(data, dict) else {}
    items_raw = data.get("itemList")
    if not isinstance(items_raw, list) or not items_raw:
        return

    max_videos = max(settings.tiktok_subtitle_max_videos_per_run, 1)
    subtitle_by_video_id: dict[str, str] = {}
    candidate_items = [item for item in items_raw if isinstance(item, dict)][:max_videos]

    for item in candidate_items:
        video_id = _normalize_item_id(item)
        if not video_id:
            continue

        existing_subtitle = str(item.get("subtitle") or "").strip()
        if existing_subtitle:
            subtitle_by_video_id[video_id] = existing_subtitle
            continue

        subtitle_text = ""
        for subtitle_url in _extract_subtitle_urls_from_item(item):
            subtitle_text = _fetch_subtitle_text(subtitle_url)
            if subtitle_text:
                break

        if subtitle_text:
            subtitle_by_video_id[video_id] = subtitle_text

    if doc_id is not None:
        fresh_doc = collection.find_one({"_id": doc_id})
    else:
        fresh_doc = _find_existing_doc(username)
    if not fresh_doc:
        return

    fresh_data = fresh_doc.get("data")
    fresh_data = dict(fresh_data) if isinstance(fresh_data, dict) else {}
    fresh_items_raw = fresh_data.get("itemList")
    if not isinstance(fresh_items_raw, list) or not fresh_items_raw:
        return

    changed = False
    updated_items: list[dict[str, Any]] = []

    for raw_item in fresh_items_raw:
        if not isinstance(raw_item, dict):
            continue
        item = dict(raw_item)
        video_id = _normalize_item_id(item)
        current_subtitle = str(item.get("subtitle") or "").strip()
        mapped_subtitle = subtitle_by_video_id.get(video_id or "", "")

        if mapped_subtitle and mapped_subtitle != current_subtitle:
            item["subtitle"] = mapped_subtitle
            current_subtitle = mapped_subtitle
            changed = True
        elif "subtitle" not in item:
            item["subtitle"] = current_subtitle
            changed = True

        updated_items.append(item)

    if not updated_items:
        return

    if not changed:
        return

    fresh_data["itemList"] = updated_items
    update_set = {"data": fresh_data}

    update_filter: dict[str, Any]
    if doc_id is not None:
        update_filter = {"_id": doc_id}
    else:
        escaped = re.escape(username)
        update_filter = {"username": {"$regex": f"^{escaped}$", "$options": "i"}}

    collection.update_one(update_filter, {"$set": update_set})
    _invalidate_influencer_cache_safely()


async def _schedule_subtitle_enrichment(username: str) -> None:
    settings = get_settings()
    if not settings.tiktok_subtitle_background_enabled:
        return

    normalized_username = _normalize_username(username).lower()
    if not normalized_username:
        return

    async with _SUBTITLE_ENRICHMENT_LOCK:
        if normalized_username in _SUBTITLE_ENRICHMENT_INFLIGHT:
            return
        _SUBTITLE_ENRICHMENT_INFLIGHT.add(normalized_username)

    async def runner() -> None:
        try:
            await asyncio.to_thread(_run_subtitle_enrichment_sync, normalized_username)
        except Exception:
            # Background enrichment should not break scraper API responses.
            pass
        finally:
            async with _SUBTITLE_ENRICHMENT_LOCK:
                _SUBTITLE_ENRICHMENT_INFLIGHT.discard(normalized_username)

    asyncio.create_task(runner(), name=f"subtitle-enrichment-{normalized_username}")


async def scrape_tiktok_user(username: str) -> dict[str, Any]:
    settings = get_settings()

    if not settings.tiktok_scraper_enabled:
        raise RuntimeError("TikTok scraper is disabled. Set TIKTOK_SCRAPER_ENABLED=true.")

    if not _PYDOLL_AVAILABLE:
        raise RuntimeError(
            "TikTok scraper dependency missing. Install `pydoll-python` in services/api."
        )

    result: dict[str, Any] = {
        "success": False,
        "username": username,
        "data": None,
        "batch_count": 0,
        "item_count": 0,
        "used_proxy": None,
        "error": None,
        "intercepted_urls": [],
    }

    options = ChromiumOptions()
    browser_binary = _resolve_browser_binary()
    if browser_binary:
        options.binary_location = browser_binary

    if settings.tiktok_scraper_headless:
        options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    custom_ua = settings.tiktok_scraper_user_agent.strip()
    if custom_ua:
        options.add_argument(f"--user-agent={custom_ua}")

    proxy = _pick_proxy()
    if proxy:
        options.add_argument(f"--proxy-server=http://{proxy}")
        result["used_proxy"] = proxy

    try:
        async with Chrome(options=options) as browser:
            tab = await browser.start()
            await tab.enable_network_events()

            collected_batches: list[dict[str, Any]] = []
            pending_requests: dict[str, dict[str, Any]] = {}
            matched_hits = 0

            async def on_response(event: Any) -> None:
                nonlocal matched_hits
                params = event.get("params") if isinstance(event, dict) else None
                if not isinstance(params, dict):
                    return
                response = params.get("response")
                if not isinstance(response, dict):
                    return
                url = str(response.get("url") or "")
                if not url:
                    return

                if len(result["intercepted_urls"]) < 25:
                    result["intercepted_urls"].append(url[:300])

                request_id = params.get("requestId")
                if not isinstance(request_id, str):
                    return

                if "/post/item_list/" not in url:
                    return
                if not _has_non_empty_query_param(url, "X-Bogus"):
                    return
                if not _has_non_empty_query_param(url, "X-Gnarly"):
                    return
                if not _has_non_empty_query_param(url, "msToken"):
                    return

                matched_hits += 1
                pending_requests[request_id] = {"url": url}

            async def on_loading_finished(event: Any) -> None:
                params = event.get("params") if isinstance(event, dict) else None
                if not isinstance(params, dict):
                    return
                request_id = params.get("requestId")
                if not isinstance(request_id, str):
                    return
                if request_id not in pending_requests:
                    return

                pending_requests.pop(request_id, None)
                body = await _get_response_body_with_retry(tab, request_id)
                if not body.strip():
                    return

                try:
                    payload = json.loads(body)
                except json.JSONDecodeError:
                    return

                if isinstance(payload, dict):
                    collected_batches.append(payload)

            async def on_loading_failed(event: Any) -> None:
                params = event.get("params") if isinstance(event, dict) else None
                if not isinstance(params, dict):
                    return
                request_id = params.get("requestId")
                if isinstance(request_id, str):
                    pending_requests.pop(request_id, None)

            await tab.on(NetworkEvent.RESPONSE_RECEIVED, on_response)
            await tab.on(NetworkEvent.LOADING_FINISHED, on_loading_finished)
            await tab.on(NetworkEvent.LOADING_FAILED, on_loading_failed)

            profile_url = f"https://www.tiktok.com/@{quote(username)}"
            await tab.go_to(profile_url, timeout=settings.tiktok_scraper_navigation_timeout_ms)

            async def wait_for_batches(min_batches: int, timeout_seconds: int) -> None:
                loop = asyncio.get_running_loop()
                deadline = loop.time() + max(timeout_seconds, 0)
                while loop.time() < deadline:
                    if len(collected_batches) >= min_batches:
                        return
                    await asyncio.sleep(0.5)

            async def wait_for_hits(min_hits: int, timeout_seconds: int) -> None:
                loop = asyncio.get_running_loop()
                deadline = loop.time() + max(timeout_seconds, 0)
                while loop.time() < deadline:
                    if matched_hits >= min_hits:
                        return
                    await asyncio.sleep(0.5)

            async def scroll_twice() -> None:
                for index in range(2):
                    try:
                        await tab.execute_script(
                            "window.scrollBy({ top: %d, left: 0, behavior: 'smooth' });"
                            % settings.tiktok_scraper_single_scroll_pixels
                        )
                    except Exception:
                        await tab.scroll.to_bottom(smooth=True, humanize=False)
                    if index == 0:
                        # Human-like randomized timeout between the two scroll passes.
                        base_pause = max(settings.tiktok_scraper_single_scroll_pause_seconds, 0.5)
                        min_pause = max(0.8, base_pause * 0.7)
                        max_pause = max(min_pause + 0.4, base_pause * 1.9)
                        await asyncio.sleep(random.uniform(min_pause, max_pause))

            async def run_sequence() -> None:
                await wait_for_batches(1, settings.tiktok_scraper_initial_wait_seconds)
                before_batches = len(collected_batches)
                before_hits = matched_hits
                await scroll_twice()
                await wait_for_hits(before_hits + 1, settings.tiktok_scraper_post_scroll_wait_seconds)
                await wait_for_batches(
                    before_batches + 1,
                    settings.tiktok_scraper_post_scroll_wait_seconds,
                )

            try:
                await asyncio.wait_for(
                    run_sequence(),
                    timeout=settings.tiktok_scraper_collection_timeout_seconds,
                )
            except asyncio.TimeoutError:
                pass

            if not collected_batches:
                result["error"] = "No matching TikTok item_list response captured."
                return result

            final_data = dict(collected_batches[-1])
            merged_items: list[dict[str, Any]] = []
            seen_ids: set[str] = set()
            for batch in collected_batches:
                raw_items = batch.get("itemList")
                if not isinstance(raw_items, list):
                    continue
                for raw_item in raw_items:
                    if not isinstance(raw_item, dict):
                        continue
                    item_id = _normalize_item_id(raw_item)
                    if item_id and item_id in seen_ids:
                        continue
                    if item_id:
                        seen_ids.add(item_id)
                    merged_items.append(raw_item)

            merged_items.sort(key=lambda item: _to_int(item.get("createTime")), reverse=True)
            final_data["itemList"] = merged_items

            result["success"] = True
            result["data"] = final_data
            result["batch_count"] = len(collected_batches)
            result["item_count"] = len(merged_items)
            return result
    except Exception as exc:
        result["error"] = str(exc)
        return result


def _find_existing_doc(username: str) -> dict[str, Any] | None:
    collection = get_influencers_collection()
    normalized = username.lower()
    projection = {"_id": 1, "username": 1, "data": 1, "latest": 1, "history": 1}

    doc = collection.find_one({"username_normalized": normalized}, projection)
    if doc:
        return doc

    escaped = re.escape(username)
    return collection.find_one({"username": {"$regex": f"^{escaped}$", "$options": "i"}}, projection)


def _build_current_metrics(
    merged_items: list[dict[str, Any]],
    existing_latest: dict[str, Any],
) -> dict[str, Any]:
    first_item = merged_items[0] if merged_items else {}
    author_stats = first_item.get("authorStats")
    if not isinstance(author_stats, dict):
        author_stats = first_item.get("authorStatsV2")
    if not isinstance(author_stats, dict):
        author_stats = {}

    now = datetime.now(timezone.utc)
    followers = _to_int(author_stats.get("followerCount")) or _to_int(existing_latest.get("followers"))
    following = _to_int(author_stats.get("followingCount")) or _to_int(existing_latest.get("following"))
    likes = _to_int(author_stats.get("heart") or author_stats.get("heartCount")) or _to_int(
        existing_latest.get("likes")
    )
    video_count = max(
        _to_int(author_stats.get("videoCount")),
        len(merged_items),
        _to_int(existing_latest.get("videoCount")),
    )

    return {
        "followers": followers,
        "following": following,
        "likes": likes,
        "videoCount": video_count,
        "fetchedAt": now,
    }


def _build_history(
    existing_history: Any,
    current_metrics: dict[str, Any],
) -> list[dict[str, Any]]:
    settings = get_settings()
    history = [item for item in existing_history if isinstance(item, dict)] if isinstance(existing_history, list) else []
    history.append(current_metrics)

    max_points = settings.tiktok_scraper_history_max_points
    if max_points > 0 and len(history) > max_points:
        history = history[-max_points:]

    return history


def store_scraped_data(username: str, scraped_data: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    collection = get_influencers_collection()
    existing_doc = _find_existing_doc(username) or {}

    existing_data = existing_doc.get("data")
    existing_data = existing_data if isinstance(existing_data, dict) else {}

    existing_latest = existing_doc.get("latest")
    existing_latest = existing_latest if isinstance(existing_latest, dict) else {}

    existing_items_raw = existing_data.get("itemList")
    existing_items = [item for item in existing_items_raw if isinstance(item, dict)] if isinstance(existing_items_raw, list) else []

    incoming_items_raw = scraped_data.get("itemList")
    incoming_items = [item for item in incoming_items_raw if isinstance(item, dict)] if isinstance(incoming_items_raw, list) else []

    merged_items, new_count, updated_count = _merge_item_lists_by_id(existing_items, incoming_items)

    if settings.tiktok_scraper_max_stored_items > 0:
        merged_items = merged_items[: settings.tiktok_scraper_max_stored_items]

    merged_data = dict(existing_data)
    for key, value in scraped_data.items():
        if key == "itemList":
            continue
        merged_data[key] = value
    merged_data["itemList"] = merged_items

    current_metrics = _build_current_metrics(merged_items, existing_latest)
    fetched_at = current_metrics["fetchedAt"]
    history = _build_history(existing_doc.get("history"), current_metrics)

    canonical_username = existing_doc.get("username")
    if not isinstance(canonical_username, str) or not canonical_username.strip():
        canonical_username = username

    raw_document = {
        "username": canonical_username,
        "data": merged_data,
        "latest": current_metrics,
        "history": history,
        "fetchedAt": fetched_at,
    }

    normalized = normalize_scraped_document_with_source(raw_document, source="saas")

    if existing_doc.get("_id") is not None:
        update_filter: dict[str, Any] = {"_id": existing_doc["_id"]}
    else:
        escaped_username = re.escape(normalized["username"])
        update_filter = {"username": {"$regex": f"^{escaped_username}$", "$options": "i"}}

    result = collection.update_one(
        update_filter,
        {"$set": normalized, "$setOnInsert": {"createdAt": fetched_at}},
        upsert=True,
    )

    return {
        "stored": bool(result.acknowledged),
        "username": normalized["username"],
        "fetched_at": fetched_at,
        "new_items": new_count,
        "updated_items": updated_count,
        "total_items": len(merged_items),
    }


async def run_tiktok_scraper_for_username(
    username: str,
    force_refresh: bool = False,
) -> dict[str, Any]:
    cleaned_username = _normalize_username(username)
    if not cleaned_username:
        raise ValueError("Username is required.")

    scrape_result = await scrape_tiktok_user(cleaned_username)
    if not scrape_result.get("success"):
        return {
            "success": False,
            "username": cleaned_username,
            "error": scrape_result.get("error") or "TikTok scraping failed.",
            "batch_count": scrape_result.get("batch_count", 0),
            "item_count": scrape_result.get("item_count", 0),
            "used_proxy": scrape_result.get("used_proxy"),
            "force_refresh": force_refresh,
        }

    stored = store_scraped_data(cleaned_username, scrape_result["data"])
    await _schedule_subtitle_enrichment(stored["username"])

    return {
        "success": True,
        "username": stored["username"],
        "message": f"Scraping completed for @{stored['username']}. Subtitle enrichment running in background.",
        "item_count": scrape_result.get("item_count", 0),
        "batch_count": scrape_result.get("batch_count", 0),
        "used_proxy": scrape_result.get("used_proxy"),
        "new_items": stored["new_items"],
        "updated_items": stored["updated_items"],
        "total_items": stored["total_items"],
        "fetched_at": stored["fetched_at"],
        "force_refresh": force_refresh,
    }

