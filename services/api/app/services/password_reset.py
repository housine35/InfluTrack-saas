from __future__ import annotations

import hashlib
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Any
from urllib.parse import quote

from app.core.config import get_settings


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_reset_token() -> str:
    return secrets.token_urlsafe(32)


def build_reset_url(token: str) -> str:
    settings = get_settings()
    base = settings.password_reset_url_base.strip().rstrip("/")
    if not base:
        base = "http://localhost:3000/reset-password"
    return f"{base}?token={quote(token)}"


def build_reset_payload(token: str) -> dict[str, Any]:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    return {
        "token_hash": hash_reset_token(token),
        "expires_at": now + timedelta(minutes=max(settings.password_reset_token_expire_minutes, 5)),
        "requested_at": now,
    }


def normalize_datetime(value: Any) -> datetime | None:
    if not isinstance(value, datetime):
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def is_password_reset_expired(payload: dict[str, Any]) -> bool:
    expires_at = normalize_datetime(payload.get("expires_at"))
    if expires_at is None:
        return True
    return expires_at <= datetime.now(timezone.utc)


def send_password_reset_email(email: str, reset_url: str) -> bool:
    settings = get_settings()
    if not settings.smtp_enabled:
        return False

    host = settings.smtp_host.strip()
    from_email = settings.smtp_from_email.strip()
    if not host or not from_email:
        return False

    message = EmailMessage()
    message["Subject"] = "InfluTrack - Reset your password"
    message["From"] = (
        f"{settings.smtp_from_name} <{from_email}>"
        if settings.smtp_from_name.strip()
        else from_email
    )
    message["To"] = email
    message.set_content(
        "\n".join(
            [
                "You requested a password reset for your InfluTrack account.",
                "",
                f"Reset link: {reset_url}",
                "",
                "If you did not request this, you can ignore this email.",
            ]
        )
    )

    timeout_seconds = 10
    try:
        if settings.smtp_use_ssl:
            with smtplib.SMTP_SSL(host, settings.smtp_port, timeout=timeout_seconds) as client:
                if settings.smtp_username.strip():
                    client.login(settings.smtp_username, settings.smtp_password)
                client.send_message(message)
            return True

        with smtplib.SMTP(host, settings.smtp_port, timeout=timeout_seconds) as client:
            if settings.smtp_use_tls:
                client.starttls()
            if settings.smtp_username.strip():
                client.login(settings.smtp_username, settings.smtp_password)
            client.send_message(message)
        return True
    except Exception:
        return False
