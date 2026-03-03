from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from pymongo.errors import DuplicateKeyError

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.mongodb import get_users_collection
from app.models.user import parse_object_id, serialize_user
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    RefreshRequest,
    RefreshResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
    UserCreate,
    UserLogin,
)
from app.services.password_reset import (
    build_reset_payload,
    build_reset_url,
    generate_reset_token,
    hash_reset_token,
    is_password_reset_expired,
    send_password_reset_email,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate) -> AuthResponse:
    users = get_users_collection()
    email = payload.email.lower().strip()
    now = datetime.now(timezone.utc)

    doc = {
        "email": email,
        "full_name": payload.full_name,
        "hashed_password": hash_password(payload.password),
        "is_active": True,
        "favorite_influencers": [],
        "created_at": now,
        "updated_at": now,
    }

    try:
        insert_result = users.insert_one(doc)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists") from exc

    user = users.find_one({"_id": insert_result.inserted_id})
    if not user:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load user")

    user_id = str(user["_id"])
    return AuthResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
        user=serialize_user(user),
    )


@router.post("/login", response_model=AuthResponse)
def login(payload: UserLogin) -> AuthResponse:
    users = get_users_collection()
    email = payload.email.lower().strip()
    user = users.find_one({"email": email})

    invalid_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
    )

    if not user or not verify_password(payload.password, user.get("hashed_password", "")):
        raise invalid_error

    if not user.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")

    user_id = str(user["_id"])
    return AuthResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
        user=serialize_user(user),
    )


@router.post("/refresh", response_model=RefreshResponse)
def refresh(payload: RefreshRequest) -> RefreshResponse:
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    try:
        token_payload = decode_token(payload.refresh_token, refresh=True)
    except ValueError as exc:
        raise unauthorized from exc

    user_id = parse_object_id(token_payload["sub"])
    if not user_id:
        raise unauthorized

    user = get_users_collection().find_one({"_id": user_id, "is_active": True})
    if not user:
        raise unauthorized

    subject = str(user["_id"])
    return RefreshResponse(
        access_token=create_access_token(subject),
        refresh_token=create_refresh_token(subject),
    )


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest) -> ForgotPasswordResponse:
    users = get_users_collection()
    settings = get_settings()
    email = payload.email.lower().strip()
    user = users.find_one({"email": email, "is_active": True}, {"_id": 1, "email": 1})

    message = "If this email exists, a reset link has been generated. Please check your inbox."
    if not user:
        return ForgotPasswordResponse(message=message)

    token = generate_reset_token()
    reset_payload = build_reset_payload(token)
    reset_url = build_reset_url(token)

    users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password_reset": reset_payload,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    send_password_reset_email(email=email, reset_url=reset_url)

    if settings.password_reset_debug_return_token:
        return ForgotPasswordResponse(
            message=message,
            reset_token=token,
            reset_url=reset_url,
        )

    return ForgotPasswordResponse(message=message)


@router.post("/reset-password", response_model=ResetPasswordResponse)
def reset_password(payload: ResetPasswordRequest) -> ResetPasswordResponse:
    users = get_users_collection()
    token_hash = hash_reset_token(payload.token)

    user = users.find_one(
        {"password_reset.token_hash": token_hash, "is_active": True},
        {"_id": 1, "password_reset": 1},
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    password_reset = user.get("password_reset")
    if not isinstance(password_reset, dict) or is_password_reset_expired(password_reset):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "hashed_password": hash_password(payload.new_password),
                "updated_at": datetime.now(timezone.utc),
            },
            "$unset": {"password_reset": ""},
        },
    )

    return ResetPasswordResponse(message="Password updated successfully. You can now log in.")
