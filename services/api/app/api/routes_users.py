from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.deps import get_current_user
from app.db.mongodb import get_influencers_collection, get_users_collection
from app.models.user import serialize_user
from app.schemas.auth import UserPublic
from app.schemas.influencer import InfluencerListResponse, InfluencerSummary
from app.services.influencer_analytics import build_influencer_summary

router = APIRouter(prefix="/users", tags=["users"])

# Keep favorite lookups lightweight.
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


class FavoriteUsernamesResponse(BaseModel):
    items: list[str] = Field(default_factory=list)


def _favorite_usernames(user_doc: dict[str, Any]) -> list[str]:
    raw_favorites = user_doc.get("favorite_influencers")
    if not isinstance(raw_favorites, list):
        return []

    favorites: list[str] = []
    seen: set[str] = set()
    for raw in raw_favorites:
        if not isinstance(raw, str):
            continue
        favorite = raw.strip()
        if not favorite:
            continue
        key = favorite.lower()
        if key in seen:
            continue
        seen.add(key)
        favorites.append(favorite)
    return favorites


def _clean_username(username: str) -> str:
    normalized = username.strip().lstrip("@")
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is required",
        )
    return normalized


def _find_canonical_influencer_username(username: str) -> str:
    influencers = get_influencers_collection()
    normalized = username.lower()
    influencer = influencers.find_one({"username_normalized": normalized}, {"username": 1})

    if not influencer:
        escaped = re.escape(username)
        influencer = influencers.find_one(
            {"username": {"$regex": f"^{escaped}$", "$options": "i"}},
            {"username": 1},
        )

    if not influencer or not isinstance(influencer.get("username"), str):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Influencer not found",
        )

    return influencer["username"]


def _load_user_or_500(user_id: Any) -> dict[str, Any]:
    user = get_users_collection().find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load user")
    return user


@router.get("/me", response_model=UserPublic)
def me(current_user: dict = Depends(get_current_user)) -> UserPublic:
    return UserPublic(**serialize_user(current_user))


@router.get("/favorites", response_model=FavoriteUsernamesResponse)
def list_favorite_usernames(
    current_user: dict = Depends(get_current_user),
) -> FavoriteUsernamesResponse:
    return FavoriteUsernamesResponse(items=_favorite_usernames(current_user))


@router.get("/favorites/influencers", response_model=InfluencerListResponse)
def list_favorite_influencers(
    current_user: dict = Depends(get_current_user),
) -> InfluencerListResponse:
    favorites = _favorite_usernames(current_user)
    if not favorites:
        return InfluencerListResponse(total=0, items=[])

    normalized_favorites = [item.lower() for item in favorites]
    docs = list(
        get_influencers_collection().find(
            {
                "$or": [
                    {"username": {"$in": favorites}},
                    {"username_normalized": {"$in": normalized_favorites}},
                ]
            },
            SUMMARY_PROJECTION,
        )
    )

    summaries_by_username: dict[str, dict[str, Any]] = {}
    for doc in docs:
        summary = build_influencer_summary(doc)
        summaries_by_username[summary["username"].lower()] = summary

    ordered_items = [
        InfluencerSummary(**summaries_by_username[username])
        for username in normalized_favorites
        if username in summaries_by_username
    ]
    return InfluencerListResponse(total=len(ordered_items), items=ordered_items)


@router.post("/favorites/{username}", response_model=UserPublic)
def add_favorite_influencer(
    username: str,
    current_user: dict = Depends(get_current_user),
) -> UserPublic:
    canonical_username = _find_canonical_influencer_username(_clean_username(username))
    now = datetime.now(timezone.utc)

    get_users_collection().update_one(
        {"_id": current_user["_id"]},
        {
            "$addToSet": {"favorite_influencers": canonical_username},
            "$set": {"updated_at": now},
        },
    )

    updated_user = _load_user_or_500(current_user["_id"])
    return UserPublic(**serialize_user(updated_user))


@router.delete("/favorites/{username}", response_model=UserPublic)
def remove_favorite_influencer(
    username: str,
    current_user: dict = Depends(get_current_user),
) -> UserPublic:
    cleaned_username = _clean_username(username)
    favorites = _favorite_usernames(current_user)
    favorites_to_remove = [item for item in favorites if item.lower() == cleaned_username.lower()]
    if not favorites_to_remove:
        favorites_to_remove = [cleaned_username]

    now = datetime.now(timezone.utc)
    get_users_collection().update_one(
        {"_id": current_user["_id"]},
        {
            "$pull": {"favorite_influencers": {"$in": favorites_to_remove}},
            "$set": {"updated_at": now},
        },
    )

    updated_user = _load_user_or_500(current_user["_id"])
    return UserPublic(**serialize_user(updated_user))

