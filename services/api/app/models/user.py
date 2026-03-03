from datetime import datetime
from typing import Any

from bson import ObjectId


def parse_object_id(value: str) -> ObjectId | None:
    if not ObjectId.is_valid(value):
        return None
    return ObjectId(value)


def serialize_user(user_doc: dict[str, Any]) -> dict[str, Any]:
    favorites = user_doc.get("favorite_influencers")
    if not isinstance(favorites, list):
        favorites = []

    return {
        "id": str(user_doc["_id"]),
        "email": user_doc["email"],
        "full_name": user_doc.get("full_name"),
        "is_active": user_doc.get("is_active", True),
        "favorite_influencers": [item for item in favorites if isinstance(item, str)],
        "created_at": _to_datetime(user_doc.get("created_at")),
        "updated_at": _to_datetime(user_doc.get("updated_at")),
    }


def _to_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    return None
