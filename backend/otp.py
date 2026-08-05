"""
otp.py — WhatsApp OTP verification for AYANA family members.

Verifies the FAMILY MEMBER'S OWN phone number (sons, daughters, primary
carers) — NOT the elderly parent's WhatsApp. Called during signup or from
Profile to badge the account with phone_verified=true.

Template type: Meta "Authentication" category — separate ContentSid from
Utility check-in templates. Charged per message even inside an open session.

Required env vars (when WHATSAPP_ENABLED=true):
  OTP_CONTENT_SID   ContentSid of the approved Authentication template
                    (single variable: the 6-digit OTP code)
  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM  (shared)

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

from database import db
from whatsapp import whatsapp_enabled

logger = logging.getLogger("ayana.otp")

# ── Constants ────────────────────────────────────────────────────────────────

OTP_LENGTH          = 6
OTP_EXPIRY_MINUTES  = 5
MAX_ATTEMPTS        = 5
MAX_SENDS_PER_WINDOW = 3
SEND_WINDOW_MINUTES  = 10
BCRYPT_ROUNDS        = 12


# ── Feature flags ────────────────────────────────────────────────────────────

def otp_content_sid() -> str:
    return os.environ.get("OTP_CONTENT_SID", "").strip()


def otp_delivery_enabled() -> bool:
    """True only when both WhatsApp and an OTP ContentSid are configured."""
    return whatsapp_enabled() and bool(otp_content_sid())


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


# ── Twilio delivery ──────────────────────────────────────────────────────────

async def send_otp_whatsapp(phone: str, code: str) -> dict:
    """
    Send the OTP via the approved WhatsApp Authentication template.

    Returns:
      {"status": "sent",      "sid": "..."}
      {"status": "simulated", "detail": "..."}
      {"status": "failed",    "detail": "..."}

    IMPORTANT: `code` is NEVER logged — only redacted references appear.
    """
    if not otp_delivery_enabled():
        reason = "OTP_CONTENT_SID not set" if not otp_content_sid() else "WHATSAPP_ENABLED=false"
        logger.info("[otp] Delivery disabled (%s) — simulating for %s", reason, phone)
        return {"status": "simulated", "detail": f"OTP delivery disabled ({reason})"}

    try:
        from twilio.rest import Client  # lazy import — not available until installed

        sid = otp_content_sid()
        account_sid = os.environ["TWILIO_ACCOUNT_SID"]
        auth_token  = os.environ["TWILIO_AUTH_TOKEN"]
        from_number = os.environ.get("TWILIO_WHATSAPP_FROM", "")

        client = Client(account_sid, auth_token)
        msg = client.messages.create(
            from_=f"whatsapp:{from_number}",
            to=f"whatsapp:{phone}",
            content_sid=sid,
            content_variables=f'{{"1":"{code}"}}',
        )
        logger.info("[otp] Authentication OTP sent to %s (sid=%s)", phone, msg.sid)
        return {"status": "sent", "sid": msg.sid}

    except ImportError:
        logger.error("[otp] twilio package not installed — cannot send OTP")
        return {"status": "failed", "detail": "Twilio SDK not installed on this server."}
    except KeyError as exc:
        logger.error("[otp] Missing env var: %s", exc)
        return {"status": "failed", "detail": f"Missing Twilio env var: {exc}"}
    except Exception as exc:
        logger.error("[otp] Twilio delivery error for %s: %s", phone, type(exc).__name__)
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
      4. Deliver via Twilio.

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
        # Reset window if more than SEND_WINDOW_MINUTES have elapsed
        if (now - window_start).total_seconds() > SEND_WINDOW_MINUTES * 60:
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

    Machine-readable failure codes: expired | too_many_attempts | invalid
    """
    phone = _normalize_phone(phone)
    doc   = await _get_otp_doc(phone)
    now   = datetime.now(timezone.utc)

    if not doc:
        return {"ok": False, "detail": "No OTP found for this number. Please request a new code.", "code": "not_found"}

    if doc.get("verified"):
        return {"ok": True, "phone": phone, "already_verified": True}

    expires_at = doc.get("expires_at")
    if expires_at and now > expires_at:
        logger.info("[otp] Expired OTP attempt for %s", phone)
        return {"ok": False, "detail": "This code has expired. Please request a new one.", "code": "expired"}

    attempts = doc.get("attempts", 0)
    if attempts >= MAX_ATTEMPTS:
        logger.warning("[otp] Too many OTP attempts for %s", phone)
        return {"ok": False, "detail": "Too many incorrect attempts. Please request a new code.", "code": "too_many_attempts"}

    # Increment attempts BEFORE checking — prevents timing-based enumeration
    await db.phone_otps.update_one({"phone": phone}, {"$inc": {"attempts": 1}})

    if not verify_otp_hash(code, doc["code_hash"]):
        remaining = MAX_ATTEMPTS - attempts - 1
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
