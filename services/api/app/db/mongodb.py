from functools import lru_cache

from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.collection import Collection
from pymongo.database import Database

from app.core.config import Settings, get_settings


@lru_cache
def get_client() -> MongoClient:
    settings: Settings = get_settings()
    return MongoClient(settings.mongodb_uri)


def get_database() -> Database:
    settings = get_settings()
    return get_client()[settings.mongodb_db_name]


def get_auth_database() -> Database:
    settings = get_settings()
    return get_client()[settings.mongodb_auth_db_name]


def get_users_collection() -> Collection:
    settings = get_settings()
    return get_auth_database()[settings.mongodb_users_collection_name]


def get_influencers_collection() -> Collection:
    settings = get_settings()
    return get_database()[settings.mongodb_collection_name]


def ensure_indexes() -> None:
    users = get_users_collection()
    users.create_index([("email", ASCENDING)], unique=True, name="unique_email")
    users.create_index(
        [("password_reset.token_hash", ASCENDING)],
        name="idx_users_password_reset_token_hash",
        sparse=True,
    )

    influencers = get_influencers_collection()
    influencers.create_index([("username", ASCENDING)], name="idx_influencers_username")
    influencers.create_index(
        [("username_normalized", ASCENDING)],
        name="idx_influencers_username_normalized",
    )
    influencers.create_index([("latest.followers", DESCENDING)], name="idx_influencers_latest_followers")

