"""
scheduler.py — APScheduler job runner for AYANA v2 message delivery.

Job 1 — _deliver_due_messages (every 1 minute)
    Smart routing: session closed -> approved template by category;
    session open -> free in-session quick-reply.
    variants_per_slot comes from the plan (Nitya=3, Bandham/Raksha=7).

Job 2 — _check_reengagement (every 15 minutes)
    Re-engagement window is now read per-schedule (reengagement_hours,
    user-set) instead of a static env constant — applies the same way
    to all three plans.

Job 3 — _check_recovery_expiry (daily)
    Raksha recovery mode: when recovery_until has passed, archive the
    extra reminder slots (mark inactive, keep the data) rather than
    deleting them, and flip mode back off so the schedule reverts to
    the normal touch count.

Job 4 — _run_monthly_reports (daily, only fires on the 1st) — OPTIONAL,
    gated by AUTO_MONTHLY_REPORTS=true. Off by default because the
    report delivery channel decision (README "Open items") should be
    made deliberately, not defaulted on.

DISTRIBUTED LOCK (new in this pass)
    APScheduler runs in-process. The moment you run more than one API
    replica, every replica's scheduler fires independently — parents
    get duplicate WhatsApp messages (and you get double-billed by
    Twilio) every single minute. `_with_lock()` wraps each job so only
    one process across the whole fleet executes it per tick: it
    upserts a short-lived doc in `scheduler_locks` with a TTL, and
    any process that loses the race to acquire it simply skips that
    tick. If the lock holder crashes mid-job, the TTL index (see
    database.ensure_indexes) expires the lock automatically instead of
    wedging delivery forever.

    This does NOT require running a separate worker process — it's
    safe to run the scheduler in every API replica as long as this
    lock wraps every job. (You may still prefer a single dedicated
    worker for clarity/cost; either way this makes concurrent
    schedulers safe by default instead of silently duplicating sends.)
"""

import logging
import os
import socket
import uuid
from datetime import datetime, timezone, date, timedelta
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from database import db
from templates_data import category_type
from whatsapp import (
    send_whatsapp_opener, send_medicine_template, send_meal_template,
    send_mood_template, send_dynamic_checkin, send_reengagement,
    is_session_open,
)
from pricing import plan_limits

logger = logging.getLogger("ayana.scheduler")

_scheduler: AsyncIOScheduler | None = None

# Unique per-process identity so lock ownership is unambiguous in logs.
_WORKER_ID = f"{socket.gethostname()}:{uuid.uuid4().hex[:8]}"


async def _with_lock(job_name: str, ttl_seconds: int, coro_fn) -> None:
    """
    Attempt to acquire a short-lived Mongo lock for `job_name`. Only the
    process that wins runs `coro_fn()`. Uses an atomic upsert with a
    filter that only matches an unheld-or-expired lock, so it's race-safe
    across replicas without needing a separate lock service.
    """
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=ttl_seconds)
    try:
        result = await db.scheduler_locks.update_one(
            {
                "_id": job_name,
                "$or": [{"expires_at": {"$lte": now}}, {"expires_at": {"$exists": False}}],
            },
            {"$set": {"holder": _WORKER_ID, "acquired_at": now, "expires_at": expires_at}},
            upsert=True,
        )
    except Exception as e:
        # Duplicate-key on a concurrent upsert race is expected/harmless —
        # it just means another replica won this tick.
        logger.debug("[sched] Lock acquire race for %s (expected under concurrency): %s", job_name, e)
        return

    won = result.upserted_id is not None or result.modified_count > 0
    if not won:
        return  # another replica holds the lock this tick — skip silently

    try:
        await coro_fn()
    finally:
        # Release early so the next tick doesn't wait out the full TTL
        # unnecessarily — best effort, TTL index is the real safety net.
        await db.scheduler_locks.update_one(
            {"_id": job_name, "holder": _WORKER_ID},
            {"$set": {"expires_at": now}},
        )


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


async def _deliver_due_messages():
    await _with_lock("deliver_due_messages", ttl_seconds=55, coro_fn=_deliver_due_messages_impl)


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


async def _check_reengagement():
    await _with_lock("check_reengagement", ttl_seconds=13 * 60, coro_fn=_check_reengagement_impl)


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


async def _check_recovery_expiry():
    await _with_lock("check_recovery_expiry", ttl_seconds=23 * 3600, coro_fn=_check_recovery_expiry_impl)


async def _run_monthly_reports_impl():
    """Only fires once/day and only does real work on the 1st of the month."""
    today = date.today()
    if today.day != 1:
        return
    from monthly_report import generate_reports_for_month
    # Report the month that just ended.
    prev_month = today.month - 1 or 12
    prev_year = today.year if today.month != 1 else today.year - 1
    logger.info("[sched] Running monthly reports for %04d-%02d", prev_year, prev_month)
    await generate_reports_for_month(prev_year, prev_month)


async def _run_monthly_reports():
    await _with_lock("run_monthly_reports", ttl_seconds=23 * 3600, coro_fn=_run_monthly_reports_impl)


async def _check_care_watch():
    await _with_lock("care_watch", ttl_seconds=4 * 60, coro_fn=run_care_watch_impl)


def start_scheduler():
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(_deliver_due_messages, "interval", minutes=1, id="ayana_delivery", max_instances=1, coalesce=True)
    _scheduler.add_job(_check_reengagement, "interval", minutes=15, id="ayana_reengagement", max_instances=1, coalesce=True)
    _scheduler.add_job(_check_recovery_expiry, "interval", hours=24, id="ayana_recovery_expiry", max_instances=1, coalesce=True)
    if os.environ.get("AUTO_MONTHLY_REPORTS", "false").strip().lower() == "true":
        _scheduler.add_job(_run_monthly_reports, "interval", hours=24, id="ayana_monthly_reports", max_instances=1, coalesce=True)
    _scheduler.start()
    logger.info(
        "AYANA v2 scheduler started on worker=%s (delivery:1min, reengagement:15min, recovery-expiry:24h, monthly-reports:%s)",
        _WORKER_ID, "on" if os.environ.get("AUTO_MONTHLY_REPORTS", "false").strip().lower() == "true" else "off",
    )


def shutdown_scheduler():
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None