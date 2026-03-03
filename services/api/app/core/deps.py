from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.security import decode_token
from app.db.mongodb import get_users_collection
from app.models.user import parse_object_id

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(token, refresh=False)
    except ValueError as exc:
        raise unauthorized from exc

    user_id = parse_object_id(payload["sub"])
    if not user_id:
        raise unauthorized

    user = get_users_collection().find_one({"_id": user_id, "is_active": True})
    if not user:
        raise unauthorized

    return user
