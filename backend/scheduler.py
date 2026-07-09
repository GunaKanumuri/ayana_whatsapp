import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from bson import ObjectId
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from database import db
from templates_data import render_message
from whatsapp import send_whatsapp

logger = logging.getLogger("ayana.scheduler")

_scheduler: AsyncIOScheduler | None = None


async def _deliver_due_messages():
    """Runs every minute. Uses each PARENT timezone as the source of truth."""
    now_utc = datetime.now(timezone.utc)

    # Fetch all active schedules into a Python list first so the DB cursor is
    # closed immediately and a mid-loop exception cannot leave it open.
    try:
        schedules = await db.schedules.find({"active": True, "deleted_at": None}).to_list(None)
    except Exception as exc:
        logger.error("Scheduler: failed to fetch schedules — %s", exc)
        return

    for sched in schedules:
        try:
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

            for idx, msg in enumerate(sched.get("messages", [])):
                if msg.get("time") != hhmm:
                    continue

                # Deduplication: skip if already delivered today
                already = await db.message_logs.find_one({
                    "schedule_id": sched["_id"],
                    "message_index": idx,
                    "day_key": day_key,
                })
                if already:
                    continue

                body = render_message(
                    msg.get("category"), parent.get("language", "en"),
                    parent.get("name", ""), msg.get("custom_text"),
                    day_index=local.timetuple().tm_yday,
                )
                result = send_whatsapp(parent.get("phone"), body)
                await db.message_logs.insert_one({
                    "user_id": sched["user_id"],
                    "parent_id": sched["parent_id"],
                    "schedule_id": sched["_id"],
                    "message_index": idx,
                    "day_key": day_key,
                    "category": msg.get("category"),
                    "body": body,
                    "status": result.get("status"),
                    "detail": result.get("detail"),
                    "sid": result.get("sid"),
                    "created_at": now_utc,
                })
                logger.info(
                    "Delivered msg (%s) to parent %s: %s",
                    result.get("status"), parent.get("name"), msg.get("category"),
                )
        except Exception as exc:
            logger.error(
                "Scheduler: unhandled error for schedule %s — %s",
                sched.get("_id"), exc,
            )


def start_scheduler():
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(_deliver_due_messages, "interval", minutes=1, id="ayana_delivery", max_instances=1, coalesce=True)
    _scheduler.start()
    logger.info("AYANA scheduler started")


def shutdown_scheduler():
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
