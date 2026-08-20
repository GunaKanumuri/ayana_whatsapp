import os
import secrets
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from bson import ObjectId
from fastapi import HTTPException, Request, Response

from database import db

JWT_ALGORITHM = "HS256"
ACCESS_TTL_MIN = 30  # 30 minutes access token
REFRESH_TTL_DAYS = 7  # 7 days refresh token


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str, role: str) -> str:
    jti = secrets.token_urlsafe(16)
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TTL_MIN),
        "type": "access",
        "jti": jti,
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str, email: str, role: str) -> str:
    jti = secrets.token_urlsafe(16)
    expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TTL_DAYS)
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": expires_at,
        "type": "refresh",
        "jti": jti,
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def serialize(doc: dict) -> dict:
    if not doc:
        return doc
    out = dict(doc)
    if "_id" in out:
        out["id"] = str(out.pop("_id"))
    out.pop("password_hash", None)
    for k, v in list(out.items()):
        if isinstance(v, ObjectId):
            out[k] = str(v)
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
    return out


def _extract_token(request: Request) -> str | None:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    return token


async def _is_token_blacklisted(jti: str) -> bool:
    """Check if a token JTI is in the blacklist."""
    if not jti:
        return False
    doc = await db.jwt_blacklist.find_one({"jti": jti})
    return doc is not None


async def revoke_token(jti: str, expires_at: datetime):
    """Add a token's JTI to the blacklist for server-side revocation."""
    await db.jwt_blacklist.update_one(
        {"jti": jti},
        {"$set": {"jti": jti, "expires_at": expires_at, "revoked_at": datetime.now(timezone.utc)}},
        upsert=True,
    )


async def get_current_user(request: Request) -> dict:
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        # Check server-side revocation
        jti = payload.get("jti")
        if await _is_token_blacklisted(jti):
            raise HTTPException(status_code=401, detail="Token has been revoked")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user or user.get("deleted_at"):
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@ayana.care").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "").strip()
    if not admin_password:
        raise ValueError(
            "ADMIN_PASSWORD env var is required. Set a strong password (min 8 chars) in your .env file."
        )
    if len(admin_password) < 8:
        raise ValueError("ADMIN_PASSWORD must be at least 8 characters.")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "name": "AYANA Admin",
            "email": admin_email,
            "phone": "+10000000000",
            "password_hash": hash_password(admin_password),
            "role": "admin",
            "onboarding_complete": True,
            "city": None,
            "timezone": "Asia/Kolkata",
            "created_at": datetime.now(timezone.utc),
            "deleted_at": None,
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password), "role": "admin"}},
        )


# ── CSRF Protection ──────────────────────────────────────────────────────────
_CSRF_COOKIE_NAME = "csrf_token"
_CSRF_HEADER_NAME = "X-CSRF-Token"
_CSRF_TOKEN_BYTES = 32


def generate_csrf_token() -> str:
    """Generate a cryptographically secure CSRF token."""
    return secrets.token_urlsafe(_CSRF_TOKEN_BYTES)


def set_csrf_cookie(response: Response, token: str) -> None:
    """Set CSRF token as a cookie. Not httpOnly so the SPA can read it
    and echo it back in the X-CSRF-Token header for double-submit validation."""
    response.set_cookie(
        key=_CSRF_COOKIE_NAME,
        value=token,
        httponly=False,  # SPA needs to read this to send in X-CSRF-Token header
        secure=True,  # Only over HTTPS in production
        samesite="lax",
        path="/",
        max_age=60 * 60 * 24 * 7,  # 7 days
    )


# ── JWT Cookie Helpers ─────────────────────────────────────────────────────────
_ACCESS_TOKEN_COOKIE = "access_token"
_REFRESH_TOKEN_COOKIE = "refresh_token"


def set_auth_cookies(response: Response, access_token: str, refresh_token: str, max_age_days: int = 7) -> None:
    """Set JWT access and refresh tokens as HttpOnly, Secure, SameSite=Strict cookies.

    With HttpOnly=True, JavaScript cannot read document.cookie — this protects
    tokens from XSS-based theft. SameSite=Strict prevents the cookies from being
    sent on cross-site requests, providing defense-in-depth against CSRF even
    though we already use a bearer-token bypass in validate_csrf_token.
    """
    max_age_seconds = max_age_days * 60 * 60 * 24
    for name, value in (
        (_ACCESS_TOKEN_COOKIE, access_token),
        (_REFRESH_TOKEN_COOKIE, refresh_token),
    ):
        response.set_cookie(
            key=name,
            value=value,
            httponly=True,   # Not accessible to JavaScript
            secure=True,     # Only over HTTPS (set False for local HTTP dev)
            samesite="strict",
            path="/",
            max_age=max_age_seconds,
        )


def clear_auth_cookies(response: Response) -> None:
    """Delete auth cookies by setting them as expired."""
    response.delete_cookie(key=_ACCESS_TOKEN_COOKIE, path="/")
    response.delete_cookie(key=_REFRESH_TOKEN_COOKIE, path="/")


def get_csrf_token_from_request(request: Request) -> str | None:
    """Extract CSRF token from cookie or header."""
    # Check cookie first
    token = request.cookies.get(_CSRF_COOKIE_NAME)
    if token:
        return token
    # Fallback to header (for API clients)
    return request.headers.get(_CSRF_HEADER_NAME)


async def validate_csrf_token(request: Request) -> None:
    """
    Validate CSRF token for state-changing operations.
    Raises HTTPException if validation fails.
    """
    # Only validate for mutating methods
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return

    # If using Bearer token auth (JWT), CSRF protection is not required.
    # CSRF is only relevant for cookie-based auth where the browser
    # auto-sends credentials. JWTs in Authorization headers are not
    # vulnerable to CSRF by design.
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return

    cookie_token = request.cookies.get(_CSRF_COOKIE_NAME)
    header_token = request.headers.get(_CSRF_HEADER_NAME)

    if not cookie_token or not header_token:
        raise HTTPException(
            status_code=403,
            detail="CSRF token missing. Please refresh the page and try again.",
        )

    if not secrets.compare_digest(cookie_token, header_token):
        raise HTTPException(
            status_code=403,
            detail="Invalid CSRF token. Please refresh the page and try again.",
        )