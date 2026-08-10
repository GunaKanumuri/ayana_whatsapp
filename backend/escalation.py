"""
escalation.py — AYANA "Care Watch" engine.

Runs on a short interval (locked, like the other scheduler jobs) and does
three things, all timezone-aware to the parent's local day:

1. RETRY unanswered check-ins / medicine reminders
     • Medicine (reminders): resend every 15 min, up to 1 hour (~4 tries)
     • Check-ins:            resend every 30 min, up to 1 hour (2 tries)
   A reply of any kind (button tap / text / voice) after the original send
   resolves it and stops the nagging.

2. AFTERNOON no-response warning to the child
   If, by the parent's local afternoon, they haven't replied to ANY of the
   day's messages (and at least one went out), the child + Care Circle +
   emergency contacts get a gentle "they haven't replied yet" alert. Once/day.

3. BIRTHDAY + FESTIVAL auto-wishes to the parent, in their language. Once/day.
"""

import logging
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from database import db
from whatsapp import send_whatsapp, send_medicine_template, send_dynamic_checkin

logger = logging.getLogger("ayana.escalation")

AFTERNOON_HOUR = 14          # local hour after which the no-reply warning fires
MED_INTERVAL_MIN = 15
MED_WINDOW_MIN = 60          # medicine: retries at +15/+30/+45/+60
CHECKIN_INTERVAL_MIN = 30
CHECKIN_WINDOW_MIN = 60      # check-in: retries at +30/+60

BIRTHDAY_WISH = {
    "en": "🎂💛 Happy Birthday, {name}! Wishing you health, laughter and love today. Your family is thinking of you.",
    "te": "🎂💛 పుట్టినరోజు శుభాకాంక్షలు, {name}! ఈరోజు మీకు ఆరోగ్యం, ఆనందం, ప్రేమ కలగాలని కోరుకుంటున్నాం. మీ కుటుంబం మిమ్మల్ని తలచుకుంటోంది.",
    "hi": "🎂💛 जन्मदिन मुबारक हो, {name}! आज आपको सेहत, हँसी और प्यार मिले। आपका परिवार आपको याद कर रहा है।",
}

# Fixed-date festivals (same MM-DD every year).
FESTIVALS = {
    "01-01": {"en": "🎉 Happy New Year, {name}! May this year be gentle and joyful for you. 💛",
              "te": "🎉 నూతన సంవత్సర శుభాకాంక్షలు, {name}! ఈ సంవత్సరం మీకు ప్రశాంతంగా, ఆనందంగా గడవాలి. 💛",
              "hi": "🎉 नववर्ष की शुभकामनाएँ, {name}! यह वर्ष आपके लिए सुखद हो। 💛"},
    "01-14": {"en": "🌾☀️ Happy Sankranti / Pongal, {name}! Wishing you warmth and sweetness today. 💛",
              "te": "🌾☀️ సంక్రాంతి శుభాకాంక్షలు, {name}! ఈ పండుగ మీకు ఆనందాన్ని తీసుకురావాలి. 💛",
              "hi": "🌾☀️ मकर संक्रांति की शुभकामनाएँ, {name}! 💛"},
    "08-15": {"en": "🇮🇳 Happy Independence Day, {name}! 💛",
              "te": "🇮🇳 స్వాతంత్ర్య దినోత్సవ శుభాకాంక్షలు, {name}! 💛",
              "hi": "🇮🇳 स्वतंत्रता दिवस की शुभकामनाएँ, {name}! 💛"},
}

# Lunar festivals vary each year — keyed by full YYYY-MM-DD (Rangwali Holi &
# Diwali Lakshmi Puja, India reference dates). Update yearly.
_HOLI = {"en": "🌈 Happy Holi, {name}! May your days be full of colour and joy. 💛",
         "te": "🌈 హోళీ శుభాకాంక్షలు, {name}! మీ జీవితం రంగులతో నిండాలి. 💛",
         "hi": "🌈 होली की शुभकामनाएँ, {name}! आपका जीवन रंगों से भरा रहे। 💛"}
_DIWALI = {"en": "🪔✨ Happy Diwali, {name}! Wishing you light, health and happiness this festive season. 💛",
           "te": "🪔✨ దీపావళి శుభాకాంక్షలు, {name}! ఈ పండుగ మీకు వెలుగు, ఆరోగ్యం, ఆనందం తీసుకురావాలి. 💛",
           "hi": "🪔✨ दीपावली की शुभकामनाएँ, {name}! यह पर्व आपके जीवन में उजाला लाए। 💛"}
LUNAR_FESTIVALS = {
    "2025-03-14": _HOLI, "2025-10-20": _DIWALI,
    "2026-03-04": _HOLI, "2026-11-08": _DIWALI,
    "2027-03-22": _HOLI, "2027-10-28": _DIWALI,
}


def _aware(dt):
    if dt and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


async def _has_reply_since(parent_id, since_dt) -> bool:
    doc = await db.parent_replies.find_one({"parent_id": parent_id, "created_at": {"$gte": since_dt}})
    return doc is not None


async def _notify_child(user_id, parent, text: str):
    """Alert owner + Care Circle members + emergency contacts."""
    owner = None
    try:
        owner = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        pass
    members = await db.users.find({"household_owner_id": str(user_id), "deleted_at": None}).to_list(20)
    phones = []
    for r in ([owner] if owner else []) + members:
        if r and r.get("phone"):
            phones.append(r["phone"])
    for c in (parent.get("emergency_contacts") or []):
        if c.get("phone"):
            phones.append(c["phone"])
    for p in dict.fromkeys(phones):  # de-dupe, keep order
        try:
            send_whatsapp(p, text)
        except Exception as e:
            logger.warning("[escalation] notify %s failed: %s", p, e)


async def run_care_watch_impl():
    now = datetime.now(timezone.utc)
    async for sched in db.schedules.find({"active": True, "deleted_at": None}):
        parent = await db.parents.find_one({"_id": sched["parent_id"]})
        if not parent or parent.get("deleted_at"):
            continue
        activation = await db.activation_state.find_one({"user_id": sched["user_id"]})
        if not activation or not activation.get("whatsapp_activated"):
            continue

        try:
            tz = ZoneInfo(parent.get("timezone", "Asia/Kolkata"))
        except Exception:
            tz = ZoneInfo("Asia/Kolkata")
        local = now.astimezone(tz)
        day_key = local.strftime("%Y-%m-%d")
        day_index = local.timetuple().tm_yday
        user_id = sched["user_id"]
        parent_id = parent["_id"]
        lang = parent.get("language", "en")
        preferred = parent.get("preferred_name") or parent.get("name") or "Amma"

        # ---- 1) Retry unanswered check-ins / medicine reminders ----
        logs = await db.message_logs.find({
            "parent_id": parent_id, "day_key": day_key,
            "msg_type": {"$in": ["checkin", "reminder"]},
            "status": {"$in": ["sent", "simulated"]},
        }).to_list(200)
        for log in logs:
            base = _aware(log.get("created_at"))
            if not base:
                continue
            kind = "medicine" if log.get("msg_type") == "reminder" else "checkin"
            interval = MED_INTERVAL_MIN if kind == "medicine" else CHECKIN_INTERVAL_MIN
            window = MED_WINDOW_MIN if kind == "medicine" else CHECKIN_WINDOW_MIN
            max_attempts = window // interval
            elapsed_min = (now - base).total_seconds() / 60
            if elapsed_min > window + interval:
                continue  # window closed
            if await _has_reply_since(parent_id, base):
                continue  # answered — stop nagging
            state = await db.escalation_state.find_one({"_id": str(log["_id"])}) or {}
            attempts = state.get("attempts", 0)
            if attempts >= max_attempts:
                continue
            due_at = base + timedelta(minutes=interval * (attempts + 1))
            if now < due_at:
                continue

            category = log.get("category", "how_feeling")
            if kind == "medicine":
                result = await send_medicine_template(db, parent, day_index, 7, "")
            else:
                result = await send_dynamic_checkin(db, parent, category, day_index, 7, "")

            await db.escalation_state.update_one(
                {"_id": str(log["_id"])},
                {"$set": {"parent_id": parent_id, "user_id": user_id, "attempts": attempts + 1,
                          "last_attempt_at": now, "kind": kind, "day_key": day_key},
                 "$setOnInsert": {"first_at": now}},
                upsert=True,
            )
            await db.message_logs.insert_one({
                "user_id": user_id, "parent_id": parent_id, "schedule_id": sched["_id"],
                "day_key": day_key, "category": category, "msg_type": "escalation",
                "status": (result or {}).get("status"), "escalation_of": str(log["_id"]),
                "attempt": attempts + 1, "kind": kind, "created_at": now,
            })
            logger.info("[escalation] %s retry #%d -> %s (%s)", kind, attempts + 1, parent.get("name"), category)

        # ---- 2) Afternoon no-response warning ----
        if local.hour >= AFTERNOON_HOUR:
            day_start_local = local.replace(hour=0, minute=0, second=0, microsecond=0)
            day_start_utc = day_start_local.astimezone(timezone.utc)
            sent_today = await db.message_logs.count_documents({
                "parent_id": parent_id, "day_key": day_key,
                "status": {"$in": ["sent", "simulated"]},
            })
            if sent_today > 0 and not await _has_reply_since(parent_id, day_start_utc):
                marker = f"{parent_id}:{day_key}:noreply"
                try:
                    await db.escalation_daily.insert_one({"_id": marker, "at": now})
                    pname = parent.get("name", "your parent")
                    await _notify_child(
                        user_id, parent,
                        f"⚠️ {pname} hasn't replied to any of today's check-ins yet. "
                        f"You may want to give them a call to make sure all is well. — AYANA 💛",
                    )
                    logger.info("[escalation] afternoon no-reply warning sent for %s", pname)
                except DuplicateKeyError:
                    pass

        # ---- 3) Birthday + festival auto-wish ----
        mmdd = local.strftime("%m-%d")
        ymd = local.strftime("%Y-%m-%d")
        greet = None
        if parent.get("birthday") == mmdd:
            greet = BIRTHDAY_WISH.get(lang, BIRTHDAY_WISH["en"]).format(name=preferred)
        elif ymd in LUNAR_FESTIVALS:
            greet = LUNAR_FESTIVALS[ymd].get(lang, LUNAR_FESTIVALS[ymd]["en"]).format(name=preferred)
        elif mmdd in FESTIVALS:
            greet = FESTIVALS[mmdd].get(lang, FESTIVALS[mmdd]["en"]).format(name=preferred)
        if greet:
            marker = f"{parent_id}:{day_key}:greet"
            try:
                await db.escalation_daily.insert_one({"_id": marker, "at": now})
                send_whatsapp(parent.get("phone", ""), greet)
                logger.info("[escalation] festival/birthday wish sent to %s", parent.get("name"))
            except DuplicateKeyError:
                pass
