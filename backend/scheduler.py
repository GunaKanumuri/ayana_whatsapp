"""
scheduler.py — APScheduler job runner for AYANA v2 message delivery.

Job 1 — _deliver_due_messages (every 1 minute)
    Smart routing: session closed -> approved template by category;
    session open -> free in-session quick-reply.
    variants_per_slot comes from the plan (Nitya=3, Bandham/Raksha=7).

Job 2 — _check_reengagement (every 15 minutes)
    Re-engagement window is read per-schedule (reengagement_hours,
    user-set) instead of a static env constant — applies the same way
    to all three plans.

Job 3 — _check_recovery_expiry (daily)
    Raksha recovery mode: when recovery_until has passed, archive the
    extra reminder slots (mark inactive, keep the data) rather than
    deleting them, and flip mode back off so the schedule reverts to
    the normal touch count.

Job 4 — _check_monthly_reports (hourly, self-gating to once/day)
    NEW: closes the "no automatic monthly cron is wired up" open item
    from the v2 README. Runs hourly but only actually generates reports
    once, on the 1st of the (UTC) month, guarded by a unique marker doc
    so re-deploys / multiple ticks that land on the 1st don't re-run it.

── Multi-instance safety ───────────────────────────────────────────────
APScheduler runs in-process. If you ever run more than one backend
replica (which you'll want for uptime), every replica would otherwise
run every job on every tick — every parent would get duplicate,
double-charged WhatsApp messages. All four jobs below acquire a
short-lived Mongo lock before doing any work; only the replica that
wins the lock executes that tick, the rest skip it silently. This
makes the scheduler safe to run on N replicas without a special
deployment topology (no need for a dedicated single "worker" process),
at the cost of one extra atomic Mongo op per job per tick.
"""

import logging
from datetime import datetime, timezone, date, timedelta
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from pymongo.errors import DuplicateKeyError

from database import db
from templates_data import category_type
from whatsapp import (
    send_whatsapp_opener, send_medicine_template, send_meal_template,
    send_mood_template, send_dynamic_checkin, send_reengagement,
    is_session_open,
)
from pricing import plan_limits
from monthly_report import generate_reports_for_month

logger = logging.getLogger("ayana.scheduler")

_scheduler: AsyncIOScheduler | None = None


# ── Distributed lock (Mongo, self-expiring) ──────────────────────────────
async def _acquire_lock(name: str, ttl_seconds: int) -> bool:
    """
    One doc per job name (`_id` = job name). Atomically claims the lock
    if it's either missing or expired. Returns True iff THIS call is the
    one that should run the job this tick.
    """
    now = datetime.now(timezone.utc)
    new_expiry = now + timedelta(seconds=ttl_seconds)

    # Case 1: lock doc exists but is stale — atomically steal it.
    # find_one_and_update only matches+updates if expires_at <= now, and
    # Mongo guarantees only one concurrent caller can win this update.
    stolen = await db.scheduler_locks.find_one_and_update(
        {"_id": name, "expires_at": {"$lte": now}},
        {"$set": {"expires_at": new_expiry, "locked_at": now}},
    )
    if stolen is not None:
        return True

    # Case 2: lock doc doesn't exist yet — try to create it. Unique _id
    # means only one concurrent caller can succeed; the rest get
    # DuplicateKeyError and correctly back off.
    try:
        await db.scheduler_locks.insert_one({"_id": name, "expires_at": new_expiry, "locked_at": now})
        return True
    except DuplicateKeyError:
        return False


async def _with_lock(job_name: str, ttl_seconds: int, coro_fn):
    try:
        if not await _acquire_lock(job_name, ttl_seconds):
            logger.debug("[sched] Skipping %s — another instance holds the lock", job_name)
            return
        await coro_fn()
    except Exception as e:
        logger.error("[sched] Job %s failed: %s", job_name, e, exc_info=True)


async def _count_sent_today(schedule_id, day_key: str, msg_type: str) -> int:
    return await db.message_logs.count_documents({"schedule_id": schedule_id, "day_key": day_key, "msg_type": msg_type})


async def _deliver_due_messages_impl():
    now_utc = datetime.now(timezone.utc)
    cursor = db.schedules.find({"active": True, "deleted_at": None})
    async for sched in cursor:
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

        local = now_utc.astimezone(tz)
        hhmm = local.strftime("%H:%M")
        day_key = local.strftime("%Y-%m-%d")
        day_index = local.timetuple().tm_yday

        limits = plan_limits(sched.get("mode", "nitya"))
        variants_per_slot = limits.get("variants_per_slot", 3)

        for idx, msg in enumerate(sched.get("messages", [])):
            if msg.get("time") != hhmm:
                continue

            already = await db.message_logs.find_one({"schedule_id": sched["_id"], "message_index": idx, "day_key": day_key})
            if already:
                continue

            category = msg.get("category", "how_feeling")
            mtype = category_type(category)
            limit_key = "checkins" if mtype == "checkin" else "reminders"
            already_sent = await _count_sent_today(sched["_id"], day_key, mtype)
            if already_sent >= limits.get(limit_key, 99):
                logger.info("[sched] Limit %s reached for user %s", limit_key, sched["user_id"])
                continue

            medicine_name = ""
            if category in ("medicine", "bp_check", "sugar_check"):
                med_list = parent.get("medicine_list", [])
                if med_list:
                    med = med_list[day_index % len(med_list)]
                    parts = [med.get("name", "")]
                    if med.get("dose"):
                        parts.append(f"({med['dose']})")
                    medicine_name = " ".join(filter(None, parts))
                else:
                    medicine_name = msg.get("custom_text") or ""

            session_open = await is_session_open(db, parent["_id"])

            if category in ("medicine", "water", "bp_check", "sugar_check", "health_check"):
                result = await send_medicine_template(db, parent, day_index, variants_per_slot, medicine_name)
            elif category in ("breakfast", "lunch", "dinner", "afternoon_checkin", "tea_check", "walk_check"):
                result = await send_meal_template(db, parent, category, day_index, variants_per_slot)
            elif category == "morning_wish":
                result = await send_whatsapp_opener(db, parent, day_index, variants_per_slot)
            elif category in ("goodnight", "love_note", "how_feeling"):
                result = await send_mood_template(db, parent, category, day_index, variants_per_slot)
            else:
                result = await send_whatsapp_opener(db, parent, day_index, variants_per_slot)

            await db.message_logs.insert_one({
                "user_id": sched["user_id"], "parent_id": sched["parent_id"], "schedule_id": sched["_id"],
                "message_index": idx, "day_key": day_key, "category": category, "msg_type": mtype,
                "status": result.get("status"), "detail": result.get("detail"), "sid": result.get("sid"),
                "template_type": result.get("template_type", "dynamic"), "session_open": session_open,
                "skipped": result.get("skipped", False), "skip_reason": result.get("reason"),
                "created_at": now_utc,
            })
            logger.info("[sched] %s -> %s (%s) %s", result.get("status"), parent.get("name"), category, "(open)" if session_open else "(closed)")


async def _check_reengagement_impl():
    """Re-engagement hours are read per-schedule — user-configurable, same mechanism for all 3 plans."""
    cursor = db.wa_sessions.find({"opener_sent_at": {"$exists": True}, "reengagement_sent": {"$ne": True}})
    async for session in cursor:
        parent_id = session.get("parent_id")
        if not parent_id:
            continue
        parent = await db.parents.find_one({"_id": parent_id, "deleted_at": None})
        if not parent:
            continue
        sched = await db.schedules.find_one({"parent_id": parent_id, "active": True, "deleted_at": None})
        reengagement_hours = (sched or {}).get("reengagement_hours", 4)
        result = await send_reengagement(db, parent, reengagement_hours)
        if result.get("status") in ("sent", "simulated"):
            logger.info("[sched] Re-engagement sent to %s", parent.get("name"))
        elif not result.get("skipped"):
            logger.warning("[sched] Re-engagement failed for %s: %s", parent.get("name"), result)


async def _check_recovery_expiry_impl():
    """
    Raksha recovery mode: when recovery_until has passed, ARCHIVE the
    extra reminder slots (is_recovery flag on ScheduleMessage/MedicineItem
    stays for history) and flip recovery_mode off so plan limits revert.
    Nothing is deleted — the user can re-enable without re-entering data.
    """
    today = date.today().isoformat()
    cursor = db.schedules.find({"recovery_mode": True, "recovery_until": {"$lte": today}, "deleted_at": None})
    async for sched in cursor:
        active_messages = [m for m in sched.get("messages", []) if not m.get("is_recovery")]
        recovery_messages = [m for m in sched.get("messages", []) if m.get("is_recovery")]
        await db.schedules.update_one(
            {"_id": sched["_id"]},
            {"$set": {
                "messages": active_messages,
                "recovery_mode": False,
                "archived_recovery_messages": recovery_messages,
            }},
        )
        logger.info("[sched] Recovery mode expired for schedule %s — archived %d slots", sched["_id"], len(recovery_messages))


async def _check_monthly_reports_impl():
    """
    Ticks hourly but only ever does real work on the 1st of the (UTC)
    month, and only once that day — a unique marker doc keyed by the
    date makes any extra ticks or redundant replica attempts no-ops.
    Household-level timezone precision isn't needed here (unlike message
    delivery): a monthly report landing a few hours either side of local
    midnight on the 1st is not time-sensitive.
    """
    today = date.today()
    if today.day != 1:
        return
    marker_id = f"monthly_report_run_{today.isoformat()}"
    try:
        await db.scheduler_run_markers.insert_one({"_id": marker_id, "ran_at": datetime.now(timezone.utc)})
    except DuplicateKeyError:
        return  # already generated this month
    target = today - timedelta(days=1)  # last day of the month that just ended
    logger.info("[sched] Generating monthly reports for %04d-%02d", target.year, target.month)
    await generate_reports_for_month(target.year, target.month)


async def _deliver_due_messages():
    await _with_lock("delivery", ttl_seconds=50, coro_fn=_deliver_due_messages_impl)


async def _check_reengagement():
    await _with_lock("reengagement", ttl_seconds=13 * 60, coro_fn=_check_reengagement_impl)


async def _check_recovery_expiry():
    await _with_lock("recovery_expiry", ttl_seconds=23 * 3600, coro_fn=_check_recovery_expiry_impl)


async def _check_monthly_reports():
    await _with_lock("monthly_reports", ttl_seconds=55 * 60, coro_fn=_check_monthly_reports_impl)


def start_scheduler():
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(_deliver_due_messages, "interval", minutes=1, id="ayana_delivery", max_instances=1, coalesce=True)
    _scheduler.add_job(_check_reengagement, "interval", minutes=15, id="ayana_reengagement", max_instances=1, coalesce=True)
    _scheduler.add_job(_check_recovery_expiry, "interval", hours=24, id="ayana_recovery_expiry", max_instances=1, coalesce=True)
    _scheduler.add_job(_check_monthly_reports, "interval", hours=1, id="ayana_monthly_reports", max_instances=1, coalesce=True)
    _scheduler.start()
    logger.info("AYANA v2 scheduler started (delivery:1min, reengagement:15min, recovery-expiry:24h, monthly-reports:hourly/gated)")


def shutdown_scheduler():
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None