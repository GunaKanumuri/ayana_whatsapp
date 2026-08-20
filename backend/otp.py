"""
otp.py — WhatsApp OTP verification for AYANA family members.

Verifies the FAMILY MEMBER'S OWN phone number (sons, daughters, primary
carers) — NOT the elderly parent's WhatsApp. Called during signup or from
Profile to badge the account with phone_verified=true.

Template type: Meta "Authentication" category — separate template from
Utility check-in templates. Charged per message even inside an open session.

Required env vars (when WHATSAPP_ENABLED=true):
  OTP_TEMPLATE_NAME   Name of the approved Authentication template
                      (single variable: the 6-digit OTP code)
  META_WA_ACCESS_TOKEN, META_WA_PHONE_NUMBER_ID  (shared)

Security properties:
  - 6-digit code hashed with bcrypt (rounds=12) — plaintext NEVER stored
  - 5-minute expiry
  - Max 5 wrong guesses before invalidation + re-send required
  - Max 3 sends per 10-minute window per number (resend rate-limit)
  - OTP codes and verification outcomes NEVER appear in log lines
"""

import logging
import os
import random
import string
from datetime import datetime, timezone, timedelta

import bcrypt
import redis.asyncio as redis
from typing import Tuple, Optional

from database import db
from whatsapp import whatsapp_enabled

logger = logging.getLogger("ayana.otp")

# ── Constants ──────────────────────────────────────────────────────────────────

OTP_LENGTH          = 6
OTP_EXPIRY_MINUTES  = 5
MAX_ATTEMPTS        = 3  # Reduced from 5 — with 3 sends per 10 min, 5 attempts = 15 total tries
MAX_SENDS_PER_WINDOW = 3
SEND_WINDOW_MINUTES  = 10
# Global rate limit on OTP verification attempts (Redis-backed, per phone)
MAX_VERIFY_ATTEMPTS_PER_WINDOW = 10  # Max verify attempts in 15-min window
VERIFY_WINDOW_MINUTES = 15  # Window in minutes for verify rate limit
BCRYPT_ROUNDS        = 12

# ── Redis connection ───────────────────────────────────────────────────────────
_redis_client = None
_redis_available = True


async def get_redis():
    """Get or create Redis connection. Returns None if Redis unavailable."""
    global _redis_client, _redis_available
    if not _redis_available:
        return None
    if _redis_client is None:
        redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        try:
            _redis_client = redis.from_url(
                redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            await _redis_client.ping()
        except Exception as e:
            logger.warning("Redis unavailable, OTP verify rate limiting disabled: %s", e)
            _redis_client = None
            _redis_available = False
            return None
    return _redis_client


def _verify_rate_limit_key(phone: str) -> str:
    return f"rl:otp_verify:{phone}"


async def _check_verify_rate_limit(phone: str) -> Tuple[bool, Optional[int]]:
    """Check if OTP verify is allowed for this phone. Returns (allowed, retry_after)."""
    r = await get_redis()
    if r is None:
        return True, None  # Allow if Redis unavailable
    key = _verify_rate_limit_key(phone)
    now = datetime.now(timezone.utc).timestamp()
    window_sec = VERIFY_WINDOW_MINUTES * 60

    # Remove expired entries from sorted set
    await r.zremrangebyscore(key, 0, now - window_sec)

    count = await r.zcard(key)
    if count >= MAX_VERIFY_ATTEMPTS_PER_WINDOW:
        oldest = await r.zrange(key, 0, 0, withscores=True)
        if oldest:
            oldest_ts = oldest[0][1]
            retry_after = int(oldest_ts + window_sec - now) + 1
            return False, max(retry_after, 1)
        return False, window_sec

    return True, None


async def _record_verify_attempt(phone: str):
    """Record an OTP verification attempt for rate limiting."""
    r = await get_redis()
    if r is None:
        return  # No-op if Redis unavailable
    key = _verify_rate_limit_key(phone)
    now = datetime.now(timezone.utc).timestamp()
    await r.zadd(key, {str(now): now})
    await r.expire(key, VERIFY_WINDOW_MINUTES * 60 + 60)


# ── Feature flags ──────────────────────────────────────────────────────────────

def otp_template_name() -> str:
    return os.environ.get("OTP_TEMPLATE_NAME", "ayana_otp").strip()


def otp_template_language() -> str:
    """Language code for the OTP authentication template (e.g., 'en', 'hi', 'te')."""
    return os.environ.get("OTP_TEMPLATE_LANGUAGE", "en").strip()


def otp_delivery_enabled() -> bool:
    """True only when WhatsApp is enabled and Meta credentials are configured."""
    return whatsapp_enabled() and bool(otp_template_name())


# ── Code generation + hashing ────────────────────────────────────────────────

def generate_otp() -> str:
    """Return a cryptographically random 6-digit string."""
    return "".join(random.SystemRandom().choices(string.digits, k=OTP_LENGTH))


def hash_otp(code: str) -> str:
    """Return bcrypt hash of the OTP code. Never log the input."""
    return bcrypt.hashpw(code.encode("utf-8"), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)).decode("utf-8")


def verify_otp_hash(code: str, stored_hash: str) -> bool:
    """Constant-time bcrypt comparison. Never log either argument."""
    try:
        return bcrypt.checkpw(code.encode("utf-8"), stored_hash.encode("utf-8"))
    except Exception:
        return False


# ── Meta Cloud API delivery ──────────────────────────────────────────────────

async def send_otp_whatsapp(phone: str, code: str) -> dict:
    """
    Send the OTP via the approved WhatsApp Authentication template (Meta Cloud API).

    Returns:
      {"status": "sent",      "message_id": "..."}
      {"status": "simulated", "detail": "..."}
      {"status": "failed",    "detail": "..."}

    IMPORTANT: `code` is NEVER logged — only redacted references appear.
    """
    if not otp_delivery_enabled():
        reason = "OTP_TEMPLATE_NAME not set" if not otp_template_name() else "WHATSAPP_ENABLED=false"
        logger.info("[otp] Delivery disabled (%s) — simulating for %s", reason, phone)
        return {"status": "simulated", "detail": f"OTP delivery disabled ({reason})"}

    try:
        import httpx

        token = os.environ.get("META_WA_ACCESS_TOKEN", "").strip()
        phone_id = os.environ.get("META_WA_PHONE_NUMBER_ID", "").strip()
        template_name = otp_template_name()

        if not token or not phone_id:
            return {"status": "failed", "detail": "Missing META_WA_ACCESS_TOKEN or META_WA_PHONE_NUMBER_ID"}

        url = f"https://graph.facebook.com/v22.0/{phone_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": otp_template_language()},
                "components": [
                    {"type": "body", "parameters": [{"type": "text", "text": code}]}
                ],
            },
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                url,
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json=payload,
            )
        resp.raise_for_status()
        data = resp.json()
        msg_id = data.get("messages", [{}])[0].get("id", "")
        logger.info("[otp] Authentication OTP sent to %s (id=%s)", phone, msg_id)
        return {"status": "sent", "message_id": msg_id}

    except KeyError as exc:
        logger.error("[otp] Missing env var: %s", exc)
        return {"status": "failed", "detail": f"Missing env var: {exc}"}
    except Exception as exc:
        logger.error("[otp] Meta delivery error for %s: %s", phone, type(exc).__name__)
        return {"status": "failed", "detail": "WhatsApp delivery failed — try again shortly."}


# ── Database helpers ─────────────────────────────────────────────────────────

def _normalize_phone(phone: str) -> str:
    """Strip spaces/dashes, ensure leading +."""
    cleaned = phone.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if cleaned and not cleaned.startswith("+"):
        cleaned = "+" + cleaned
    return cleaned


async def _get_otp_doc(phone: str) -> dict | None:
    return await db.phone_otps.find_one({"phone": phone})


async def create_and_send_otp(phone: str) -> dict:
    """
    Full send flow:
      1. Check resend rate-limit (max 3/10-min window).
      2. Generate + hash a fresh OTP.
      3. Upsert the phone_otps document (resets attempts + expiry).
      4. Deliver via Meta Cloud API.

    Returns send result dict + {phone, expires_at}.
    Never returns the plaintext OTP.
    """
    phone = _normalize_phone(phone)
    now   = datetime.now(timezone.utc)

    # ── Rate-limit check ──────────────────────────────────────────────────
    existing = await _get_otp_doc(phone)
    if existing:
        window_start = existing.get("send_window_start", now)
        send_count   = existing.get("send_count", 0)
        # Ensure window_start is timezone-aware
        if window_start and window_start.tzinfo is None:
            window_start = window_start.replace(tzinfo=timezone.utc)
        # Reset window if more than SEND_WINDOW_MINUTES have elapsed
        if window_start and (now - window_start).total_seconds() > SEND_WINDOW_MINUTES * 60:
            send_count   = 0
            window_start = now
        if send_count >= MAX_SENDS_PER_WINDOW:
            secs_left = int(SEND_WINDOW_MINUTES * 60 - (now - window_start).total_seconds())
            logger.warning("[otp] Resend rate-limit hit for %s", phone)
            return {
                "status": "rate_limited",
                "detail": f"Too many OTP requests. Try again in {max(secs_left, 1)} seconds.",
                "retry_after_seconds": max(secs_left, 1),
            }
    else:
        window_start = now
        send_count   = 0

    # ── Generate + hash ───────────────────────────────────────────────────
    code       = generate_otp()          # plaintext — used only here, never stored
    code_hash  = hash_otp(code)
    expires_at = now + timedelta(minutes=OTP_EXPIRY_MINUTES)

    await db.phone_otps.update_one(
        {"phone": phone},
        {"$set": {
            "phone":             phone,
            "code_hash":         code_hash,
            "expires_at":        expires_at,
            "attempts":          0,
            "verified":          False,
            "created_at":        now,
            "send_count":        send_count + 1,
            "send_window_start": window_start,
        }},
        upsert=True,
    )

    # ── Deliver ───────────────────────────────────────────────────────────
    result = await send_otp_whatsapp(phone, code)
    result["phone"]      = phone
    result["expires_at"] = expires_at.isoformat()
    return result


async def verify_otp_code(phone: str, code: str) -> dict:
    """
    Verify submitted code against the stored hash.

    Returns:
      {"ok": True,  "phone": ...}                  — success
      {"ok": False, "detail": "...", "code": "..."}  — failure with machine-readable code

    Machine-readable failure codes: expired | too_many_attempts | invalid | rate_limited
    """
    phone = _normalize_phone(phone)

    # Check global verify rate limit (Redis-backed, per phone)
    allowed, retry_after = await _check_verify_rate_limit(phone)
    if not allowed:
        logger.warning("[otp] Verify rate limit hit for %s", phone)
        return {
            "ok": False,
            "detail": f"Too many verification attempts. Try again in {retry_after} seconds.",
            "code": "rate_limited",
            "retry_after_seconds": retry_after,
        }

    doc   = await _get_otp_doc(phone)
    now   = datetime.now(timezone.utc)

    if not doc:
        return {"ok": False, "detail": "No OTP found for this number. Please request a new code.", "code": "not_found"}

    if doc.get("verified"):
        return {"ok": True, "phone": phone, "already_verified": True}

    expires_at = doc.get("expires_at")
    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if now > expires_at:
            logger.info("[otp] Expired OTP attempt for %s", phone)
            return {"ok": False, "detail": "This code has expired. Please request a new one.", "code": "expired"}

    # Atomic verify: increment attempts counter and fetch updated doc in one operation
    # This prevents race conditions where concurrent requests could exceed MAX_ATTEMPTS
    updated_doc = await db.phone_otps.find_one_and_update(
        {"phone": phone, "attempts": {"$lt": MAX_ATTEMPTS}},
        {"$inc": {"attempts": 1}},
        return_document=True,  # Return updated document
    )

    if not updated_doc:
        # Either OTP not found, already verified, or attempts >= MAX_ATTEMPTS
        doc = await _get_otp_doc(phone)
        if not doc:
            return {"ok": False, "detail": "No OTP found for this number. Please request a new code.", "code": "not_found"}
        if doc.get("verified"):
            return {"ok": True, "phone": phone, "already_verified": True}
        # Must be attempts >= MAX_ATTEMPTS
        logger.warning("[otp] Too many OTP attempts for %s", phone)
        return {"ok": False, "detail": "Too many incorrect attempts. Please request a new code.", "code": "too_many_attempts"}

    # Record verify attempt for global rate limit
    await _record_verify_attempt(phone)

    attempts = updated_doc.get("attempts", 0)
    code_hash = updated_doc.get("code_hash")

    if not verify_otp_hash(code, code_hash):
        remaining = MAX_ATTEMPTS - attempts
        logger.info("[otp] Wrong OTP for %s (%d attempts left)", phone, remaining)
        return {
            "ok":      False,
            "detail":  f"Incorrect code. {remaining} attempt{'s' if remaining != 1 else ''} remaining.",
            "code":    "invalid",
            "attempts_remaining": remaining,
        }

    # ── Success ───────────────────────────────────────────────────────────
    await db.phone_otps.update_one(
        {"phone": phone},
        {"$set": {"verified": True, "verified_at": now}},
    )
    logger.info("[otp] Phone %s verified successfully", phone)
    return {"ok": True, "phone": phone}
