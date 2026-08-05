"""
monthly_report.py — Monthly (not daily) summary reports for AYANA.

Why monthly: parents already get real-time replies over WhatsApp when
they tap in, so a daily digest is redundant. A single day also has too
few data points for a meaningful mood trend. Monthly gives the mood
graph something real to show and matches all 3 plans' report cadence.

Report depth by plan:
  Nitya   — simple tap/skip counts, no mood graph
  Bandham — counts + mood graph with a short trend note
  Raksha  — same as Bandham, fanned out to both Care Circle members

Delivery: written to the `monthly_reports` collection for the frontend
to fetch (GET /reports/monthly), AND pushed as a WhatsApp notification
(the 6th approved template, "report_ready") to the child — not the
full report, just a short "it's ready" nudge with a link, since the
mood graph is dashboard-only content. Raksha plans fan this out to
both Care Circle members so neither assumes the other checked it.

Language: the child/account-owner record has no language field of its
own, so the notification is sent in the PARENT's configured language
as a proxy (reasonable default — families overwhelmingly share a
language) until a dedicated user-level language preference exists.
"""

import logging
from datetime import datetime, timezone
from calendar import monthrange
from bson import ObjectId

from database import db
from pricing import plan_limits
from whatsapp import send_report_ready

logger = logging.getLogger("ayana.monthly_report")

_FEELING_SCORE = {"good": 1.0, "okay": 0.5, "not_well": 0.0}


def _month_bounds(year: int, month: int) -> tuple[str, str]:
    last_day = monthrange(year, month)[1]
    return f"{year:04d}-{month:02d}-01", f"{year:04d}-{month:02d}-{last_day:02d}"


async def _mood_series(parent_id, start_day: str, end_day: str) -> list[dict]:
    """One point per day the parent tapped a feeling — used for the mood graph."""
    cursor = db.message_logs.find({
        "parent_id": parent_id,
        "day_key": {"$gte": start_day, "$lte": end_day},
        "category": {"$in": ["how_feeling", "morning_wish", "goodnight"]},
    }).sort("day_key", 1)
    series = []
    async for log in cursor:
        # feeling is recorded on the reply side (parent_replies), not the outbound log —
        # join by day_key + parent_id for the closest reply that day.
        reply = await db.parent_replies.find_one({
            "parent_id": parent_id,
            "created_at": {
                "$gte": datetime.strptime(log["day_key"], "%Y-%m-%d").replace(tzinfo=timezone.utc),
            },
            "intent": {"$regex": "^feeling:"},
        }, sort=[("created_at", 1)])
        if reply and reply.get("intent", "").startswith("feeling:"):
            feeling = reply["intent"].split(":", 1)[1]
            series.append({"day": log["day_key"], "feeling": feeling, "score": _FEELING_SCORE.get(feeling)})
    return series


def _trend_note(series: list[dict]) -> str:
    scored = [p["score"] for p in series if p["score"] is not None]
    if len(scored) < 4:
        return "Not enough check-ins yet this month for a trend."
    first_half = scored[: len(scored) // 2]
    second_half = scored[len(scored) // 2:]
    avg1 = sum(first_half) / len(first_half)
    avg2 = sum(second_half) / len(second_half)
    diff = avg2 - avg1
    if diff > 0.15:
        return "Mood trended upward this month."
    if diff < -0.15:
        return "Mood dipped somewhat this month — might be worth a call."
    return "Mood stayed fairly steady this month."


async def _notify_report_ready(user_id: str, parent_id, period: str, shared: bool) -> None:
    """Push the report_ready WhatsApp template to the account owner, and to
    Care Circle members too when the plan shares reports (Raksha). Failures
    here are logged, never raised — the report itself is already saved
    regardless of whether the nudge goes out."""
    parent = await db.parents.find_one({"_id": parent_id})
    if not parent:
        return
    parent_display = parent.get("preferred_name") or parent.get("name", "Amma")
    language = parent.get("language", "en")
    report_link_suffix = f"reports/{parent_id}/{period}"

    owner = await db.users.find_one({"_id": ObjectId(user_id)})
    recipients = [owner] if owner else []
    if shared:
        members = await db.users.find({"household_owner_id": user_id, "deleted_at": None}).to_list(20)
        recipients += members

    for r in recipients:
        if not r or not r.get("phone"):
            continue
        try:
            await send_report_ready(
                r["phone"], language, r.get("name", "there"), parent_display, report_link_suffix,
            )
        except Exception as e:
            logger.error("[monthly_report] report_ready notify failed for user %s: %s", r.get("_id"), e)


async def generate_monthly_report(user_id: str, parent_id, plan_id: str, year: int, month: int) -> dict:
    start_day, end_day = _month_bounds(year, month)
    limits = plan_limits(plan_id)

    logs = await db.message_logs.find({
        "parent_id": parent_id, "day_key": {"$gte": start_day, "$lte": end_day},
    }).to_list(2000)

    total = len(logs)
    sent = sum(1 for l in logs if l.get("status") in ("sent", "simulated"))
    skipped = sum(1 for l in logs if l.get("skipped"))
    voice_replies = await db.parent_replies.count_documents({
        "parent_id": parent_id, "is_voice": True,
        "created_at": {"$gte": datetime.strptime(start_day, "%Y-%m-%d").replace(tzinfo=timezone.utc)},
    })

    report = {
        "user_id": user_id,
        "parent_id": parent_id,
        "plan": plan_id,
        "period": f"{year:04d}-{month:02d}",
        "total_touches": total,
        "delivered": sent,
        "skipped": skipped,
        "voice_replies": voice_replies,
        "mood_graph": None,
        "trend_note": None,
        "shared_with_care_circle": limits.get("family_members", 1) > 1,
        "generated_at": datetime.now(timezone.utc),
    }

    # Mood graph + analysis: Bandham and Raksha only (matches plan feature table)
    if limits.get("variants_per_slot", 3) >= 7:
        series = await _mood_series(parent_id, start_day, end_day)
        report["mood_graph"] = series
        report["trend_note"] = _trend_note(series)

    await db.monthly_reports.update_one(
        {"user_id": user_id, "parent_id": parent_id, "period": report["period"]},
        {"$set": report},
        upsert=True,
    )
    await _notify_report_ready(user_id, parent_id, report["period"], report["shared_with_care_circle"])
    return report


async def generate_reports_for_month(year: int, month: int):
    """Run once/month (e.g. 1st of the month, per household) across all active users."""
    cursor = db.parents.find({"deleted_at": None})
    async for parent in cursor:
        ps = await db.payment_state.find_one({"user_id": parent["user_id"]})
        plan_id = (ps or {}).get("plan", "nitya")
        try:
            await generate_monthly_report(parent["user_id"], parent["_id"], plan_id, year, month)
        except Exception as e:
            logger.error("[monthly_report] Failed for parent %s: %s", parent["_id"], e, exc_info=True)