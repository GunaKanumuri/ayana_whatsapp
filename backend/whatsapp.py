"""
whatsapp.py — All outbound WhatsApp sending for AYANA v2.

5 approved Content templates cover every category (opener/medicine/meal/
mood/reengagement — same structure as v1). Retry-on-failure now applies
uniformly to all plan tiers (no "priority delivery" tier gating — see
README). Re-engagement timing is read per-schedule (user-configurable),
not a static env constant.
"""

import logging
import os
import json
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List, Tuple

from templates_data import (
    DEFAULT_EMERGENCY_KEYWORDS, render_slot_body, render_slot_body_async,
    render_slot_buttons, get_template_sid_key,
)

logger = logging.getLogger("ayana.whatsapp")

SESSION_WINDOW_HOURS = 24
MAX_BUTTONS = 3
MAX_BUTTON_TITLE_LEN = 20
MAX_SEND_RETRIES = 3
RETRY_BACKOFF_SECONDS = 2  # exponential: 2s, 4s, 8s

_TEMPLATE_SID_ENV = {
    "opener": {"en": "TWILIO_OPENER_SID_EN", "te": "TWILIO_OPENER_SID_TE", "hi": "TWILIO_OPENER_SID_HI"},
    "medicine": {"en": "TWILIO_MEDICINE_SID_EN", "te": "TWILIO_MEDICINE_SID_TE", "hi": "TWILIO_MEDICINE_SID_HI"},
    "meal": {"en": "TWILIO_MEAL_SID_EN", "te": "TWILIO_MEAL_SID_TE", "hi": "TWILIO_MEAL_SID_HI"},
    "mood": {"en": "TWILIO_MOOD_SID_EN", "te": "TWILIO_MOOD_SID_TE", "hi": "TWILIO_MOOD_SID_HI"},
    "reengagement": {"en": "TWILIO_REENGAGEMENT_SID_EN", "te": "TWILIO_REENGAGEMENT_SID_TE", "hi": "TWILIO_REENGAGEMENT_SID_HI"},
}


def whatsapp_enabled() -> bool:
    return os.environ.get("WHATSAPP_ENABLED", "false").strip().lower() == "true"


def _creds() -> Tuple[str, str, str]:
    return (
        os.environ.get("TWILIO_ACCOUNT_SID", "").strip(),
        os.environ.get("TWILIO_AUTH_TOKEN", "").strip(),
        os.environ.get("TWILIO_WHATSAPP_FROM", "").strip(),
    )


def _get_template_sid(template_key: str, language: str) -> str:
    env_map = _TEMPLATE_SID_ENV.get(template_key, _TEMPLATE_SID_ENV["opener"])
    env_var = env_map.get(language, env_map.get("en", ""))
    return os.environ.get(env_var, "").strip()


def send_whatsapp(to_phone: str, body: str) -> Dict[str, Any]:
    sid, token, from_number = _creds()
    if not whatsapp_enabled() or not sid or not token or not from_number:
        logger.info("[wa] Simulated (test mode): %s → %.60s…", to_phone, body)
        return {"status": "simulated", "detail": "WhatsApp disabled (test mode)", "to": to_phone}
    try:
        from twilio.rest import Client
        client = Client(sid, token)
        msg = client.messages.create(from_=f"whatsapp:{from_number}", to=f"whatsapp:{to_phone}", body=body)
        logger.info("[wa] Plain text sent to %s sid=%s", to_phone, msg.sid)
        return {"status": "sent", "sid": msg.sid, "to": to_phone}
    except Exception as e:
        logger.error("[wa] Send failed to %s: %s", to_phone, e, exc_info=True)
        return {"status": "failed", "detail": str(e), "to": to_phone}


def _send_content_template_once(to_phone: str, content_sid: str, content_variables: Dict[str, str], template_key: str) -> Optional[Dict[str, Any]]:
    sid, token, from_number = _creds()
    if not whatsapp_enabled() or not sid or not token or not from_number:
        logger.info("[wa] Template %s skipped (test mode) for %s", template_key, to_phone)
        return None
    if not content_sid:
        logger.warning("[wa] No ContentSid for template %s, to=%s", template_key, to_phone)
        return None
    from twilio.rest import Client
    client = Client(sid, token)
    msg = client.messages.create(
        from_=f"whatsapp:{from_number}", to=f"whatsapp:{to_phone}",
        content_sid=content_sid, content_variables=json.dumps(content_variables),
    )
    return {"status": "sent", "sid": msg.sid, "template_type": template_key}


async def _send_content_template_with_retry(to_phone: str, content_sid: str, content_variables: Dict[str, str], template_key: str) -> Optional[Dict[str, Any]]:
    """Retry on failure — applies equally to every plan tier, no priority gating."""
    sid, token, from_number = _creds()
    if not whatsapp_enabled() or not sid or not token or not from_number:
        return _send_content_template_once(to_phone, content_sid, content_variables, template_key)

    last_error = None
    for attempt in range(1, MAX_SEND_RETRIES + 1):
        try:
            return _send_content_template_once(to_phone, content_sid, content_variables, template_key)
        except Exception as e:
            last_error = e
            logger.warning("[wa] Send attempt %s/%s failed (type=%s) to %s: %s", attempt, MAX_SEND_RETRIES, template_key, to_phone, e)
            if attempt < MAX_SEND_RETRIES:
                await asyncio.sleep(RETRY_BACKOFF_SECONDS * attempt)
    logger.error("[wa] All %s send attempts failed (type=%s) to %s: %s", MAX_SEND_RETRIES, template_key, to_phone, last_error)
    return {"status": "failed", "detail": str(last_error), "template_type": template_key}


def _button_key(safe_buttons: List[Tuple[str, str]]) -> str:
    """Stable cache key for a specific (label, payload) button set."""
    import hashlib
    raw = "|".join(f"{l}:{p}" for l, p in safe_buttons)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


async def _get_or_create_quick_reply_sid(
    db, client, body: str, safe_buttons: List[Tuple[str, str]], context: str, language: str,
) -> Optional[str]:
    """
    Twilio quick-reply buttons are delivered via a Content resource.
    Previously a NEW Content resource was created via the Twilio API on
    EVERY single message send — one extra API round-trip per message,
    plus an orphaned Content object left behind forever (Twilio has no
    auto-cleanup). The button SET (labels + payloads) is static per
    (category, language) — only the free-text `body` line varies per
    send, and quick-reply Content resources support a body placeholder,
    so the button layout itself can be created once and reused.

    Cached in db.content_sid_cache keyed by (context, language,
    button_key). First send for a given category+language pays the
    Content-creation cost; every send after that is a plain cache read.
    """
    btn_key = _button_key(safe_buttons)
    cached = await db.content_sid_cache.find_one({"context": context, "language": language, "button_key": btn_key})
    if cached and cached.get("content_sid"):
        return cached["content_sid"]

    content_payload = {"types": {"twilio/quick-reply": {
        "body": "{{1}}",  # placeholder — filled per-send via content_variables
        "actions": [{"title": l, "id": p} for l, p in safe_buttons],
    }}}
    try:
        content_resp = client.content.v2.content_and_approvals.create(
            friendly_name=f"ayana_{context}_{language}_{btn_key}",
            **content_payload,
        )
    except Exception as e:
        logger.warning("[wa] Content creation failed for %s/%s: %s", context, language, e)
        return None

    try:
        await db.content_sid_cache.update_one(
            {"context": context, "language": language, "button_key": btn_key},
            {"$set": {"content_sid": content_resp.sid, "created_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
    except Exception as e:
        logger.warning("[wa] Failed to cache Content SID for %s/%s: %s", context, language, e)
    return content_resp.sid


async def _send_quick_reply(
    db, to_phone: str, body: str, buttons: List[Tuple[str, str]], context: str = "dynamic", language: str = "en",
) -> Dict[str, Any]:
    sid, token, from_number = _creds()
    buttons = buttons[:MAX_BUTTONS]
    safe_buttons = [(l[:MAX_BUTTON_TITLE_LEN] if len(l) > MAX_BUTTON_TITLE_LEN else l, p) for l, p in buttons]

    if not whatsapp_enabled() or not sid or not token or not from_number:
        btn_text = " ".join(f"{i+1}) {label}" for i, (label, _) in enumerate(safe_buttons))
        full_body = f"{body}\n\n👉 {btn_text} — or 🎤 voice reply"
        logger.info("[wa] Simulated quick-reply %s to %s", context, to_phone)
        return send_whatsapp(to_phone, full_body)

    try:
        from twilio.rest import Client
        client = Client(sid, token)
        content_sid = await _get_or_create_quick_reply_sid(db, client, body, safe_buttons, context, language)
        if not content_sid:
            raise RuntimeError("no content_sid available")
        msg = client.messages.create(
            from_=f"whatsapp:{from_number}", to=f"whatsapp:{to_phone}",
            content_sid=content_sid, content_variables=json.dumps({"1": body}),
        )
        return {"status": "sent", "sid": msg.sid, "context": context}
    except Exception as e:
        logger.warning("[wa] Quick-reply API failed (%s), fallback to plain text: %s", context, e)
        btn_text = " ".join(f"{i+1}) {label}" for i, (label, _) in enumerate(safe_buttons))
        return send_whatsapp(to_phone, f"{body}\n\n👉 {btn_text}")


# ── Session state ────────────────────────────────────────────────────────
async def get_session(db, parent_id) -> Optional[Dict[str, Any]]:
    from bson import ObjectId
    pid = ObjectId(parent_id) if not isinstance(parent_id, ObjectId) else parent_id
    return await db.wa_sessions.find_one({"parent_id": pid})


async def is_session_open(db, parent_id) -> bool:
    session = await get_session(db, parent_id)
    if not session:
        return False
    last_inbound = session.get("last_inbound_at")
    if not last_inbound:
        return False
    cutoff = datetime.now(timezone.utc) - timedelta(hours=SESSION_WINDOW_HOURS)
    if last_inbound.tzinfo is None:
        last_inbound = last_inbound.replace(tzinfo=timezone.utc)
    return last_inbound >= cutoff


async def refresh_session(db, parent_id) -> None:
    from bson import ObjectId
    pid = ObjectId(parent_id) if not isinstance(parent_id, ObjectId) else parent_id
    now = datetime.now(timezone.utc)
    await db.wa_sessions.update_one(
        {"parent_id": pid},
        {"$set": {"parent_id": pid, "last_inbound_at": now, "session_open": True, "last_activity": now}},
        upsert=True,
    )


async def mark_opener_sent(db, parent_id, template_type: str = "opener") -> None:
    from bson import ObjectId
    pid = ObjectId(parent_id) if not isinstance(parent_id, ObjectId) else parent_id
    now = datetime.now(timezone.utc)
    await db.wa_sessions.update_one(
        {"parent_id": pid},
        {"$set": {"parent_id": pid, "opener_sent_at": now, "last_template_type": template_type, "reengagement_sent": False, "last_outbound_at": now}},
        upsert=True,
    )


async def mark_reengagement_sent(db, parent_id) -> None:
    from bson import ObjectId
    pid = ObjectId(parent_id) if not isinstance(parent_id, ObjectId) else parent_id
    await db.wa_sessions.update_one(
        {"parent_id": pid},
        {"$set": {"reengagement_sent": True, "reengagement_sent_at": datetime.now(timezone.utc)}},
        upsert=True,
    )


# ── Public sending API ───────────────────────────────────────────────────
async def send_template_for_category(db, parent: Dict[str, Any], category: str, day_index: int, variants_per_slot: int, medicine_name: str = "") -> Dict[str, Any]:
    """
    Unified entry point: resolves category -> one of the 5 approved
    templates, renders the {{2}} body via render_slot_body (nicknames,
    season, habits, stories all applied), sends with retry.
    """
    parent_id = parent["_id"]
    phone = parent.get("phone", "")
    language = parent.get("language", "en")
    preferred = parent.get("preferred_name") or parent.get("name", "") or "Amma"

    if await is_session_open(db, parent_id):
        return await send_dynamic_checkin(db, parent, category, day_index, variants_per_slot, medicine_name)

    template_key = get_template_sid_key(category)
    content_sid = _get_template_sid(template_key, language)
    # Async render: static zero-cost fast-path for en/te/hi, AI-translate
    # + permanently-cached path for any other configured language — see
    # templates_data.render_slot_body_async / translation_engine.py.
    body = await render_slot_body_async(db, category, language, parent, day_index, medicine_name or "your medicine", variants_per_slot)

    if content_sid and whatsapp_enabled():
        result = await _send_content_template_with_retry(phone, content_sid, {"1": preferred, "2": body}, template_key)
    else:
        result = send_whatsapp(phone, body)

    if result and result.get("status") in ("sent", "simulated"):
        await mark_opener_sent(db, parent_id, template_key)
    return result or {"status": "failed", "detail": "No result from template send"}


# Back-compat named wrappers (used by scheduler / API for explicit sends)
async def send_whatsapp_opener(db, parent, day_index: int = 0, variants_per_slot: int = 7):
    if await is_session_open(db, parent["_id"]):
        return {"skipped": True, "reason": "session_open"}
    return await send_template_for_category(db, parent, "morning_wish", day_index, variants_per_slot)


async def send_medicine_template(db, parent, day_index: int = 0, variants_per_slot: int = 7, medicine_name: str = ""):
    return await send_template_for_category(db, parent, "medicine", day_index, variants_per_slot, medicine_name)


async def send_meal_template(db, parent, meal_type: str = "lunch", day_index: int = 0, variants_per_slot: int = 7):
    return await send_template_for_category(db, parent, meal_type, day_index, variants_per_slot)


async def send_mood_template(db, parent, category: str = "goodnight", day_index: int = 0, variants_per_slot: int = 7):
    return await send_template_for_category(db, parent, category, day_index, variants_per_slot)


async def send_dynamic_checkin(db, parent: Dict[str, Any], category: str, day_index: int, variants_per_slot: int, medicine_name: str = "") -> Dict[str, Any]:
    """FREE in-session quick-reply — no approval needed while session is open."""
    parent_id = parent["_id"]
    phone = parent.get("phone", "")
    language = parent.get("language", "en")

    if not await is_session_open(db, parent_id):
        return await send_template_for_category(db, parent, category, day_index, variants_per_slot, medicine_name)

    body = await render_slot_body_async(db, category, language, parent, day_index, medicine_name or "your medicine", variants_per_slot)
    buttons = render_slot_buttons(category, language)
    return await _send_quick_reply(db, phone, body, buttons, context=category, language=language)


async def send_reengagement(db, parent: Dict[str, Any], reengagement_hours: int = 4) -> Dict[str, Any]:
    """Fires after `reengagement_hours` (user-configurable per schedule, not a static tier constant)."""
    parent_id = parent["_id"]
    phone = parent.get("phone", "")
    language = parent.get("language", "en")
    preferred = parent.get("preferred_name") or parent.get("name", "") or "Amma"

    session = await get_session(db, parent_id)
    if not session:
        return {"skipped": True, "reason": "no_session"}
    if session.get("reengagement_sent"):
        return {"skipped": True, "reason": "already_sent"}

    opener_sent_at = session.get("opener_sent_at")
    last_inbound = session.get("last_inbound_at")
    if not opener_sent_at:
        return {"skipped": True, "reason": "no_opener_sent"}
    if opener_sent_at.tzinfo is None:
        opener_sent_at = opener_sent_at.replace(tzinfo=timezone.utc)

    hours_since = (datetime.now(timezone.utc) - opener_sent_at).total_seconds() / 3600
    if hours_since < reengagement_hours:
        return {"skipped": True, "reason": f"too_soon ({hours_since:.1f}h < {reengagement_hours}h)"}

    if last_inbound:
        if last_inbound.tzinfo is None:
            last_inbound = last_inbound.replace(tzinfo=timezone.utc)
        if last_inbound > opener_sent_at:
            return {"skipped": True, "reason": "parent_replied"}

    content_sid = _get_template_sid("reengagement", language)
    if content_sid and whatsapp_enabled():
        result = await _send_content_template_with_retry(phone, content_sid, {"1": preferred}, "reengagement")
    else:
        body = f"{preferred}, we miss hearing from you 💛\n\nJust checking — are you alright?"
        result = send_whatsapp(phone, body)

    if result and result.get("status") in ("sent", "simulated"):
        await mark_reengagement_sent(db, parent_id)
    return result or {"status": "failed", "detail": "No result"}


# ── Signature validation ─────────────────────────────────────────────────
def verify_twilio_signature(url: str, params: dict, signature: str) -> bool:
    if not whatsapp_enabled():
        return True
    _, token, _ = _creds()
    if not token:
        return False
    try:
        from twilio.request_validator import RequestValidator
        return RequestValidator(token).validate(url, params, signature or "")
    except Exception as e:
        logger.error("[wa] Signature validation error: %s", e)
        return False


# ── Emergency keyword layer (fast-path fail-safe; see distress_detection.py for layer 2) ──
def detect_emergency(text: str, extra_keywords: Optional[List[str]] = None) -> List[str]:
    if not text:
        return []
    keywords = list(DEFAULT_EMERGENCY_KEYWORDS) + (extra_keywords or [])
    low = text.lower()
    matched = [k for k in keywords if k.lower() in low]
    if matched:
        logger.warning("[wa] Emergency keyword(s) matched in inbound text")
    return matched


# ── Intent routing ───────────────────────────────────────────────────────
NUMERIC_CHECKIN_MAP = {"1": "feeling:good", "2": "feeling:okay", "3": "feeling:not_well"}
NUMERIC_REMINDER_MAP = {"1": "done:generic", "2": "pending:generic", "3": "skip:generic"}


def parse_intent(button_payload: Optional[str], body: Optional[str], last_msg_type: str = "checkin") -> str:
    if button_payload:
        return button_payload
    text = (body or "").strip()
    if not text:
        return "text"
    numeric_map = NUMERIC_CHECKIN_MAP if last_msg_type == "checkin" else NUMERIC_REMINDER_MAP
    if text in numeric_map:
        return numeric_map[text]
    return "text"