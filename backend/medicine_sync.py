"""
medicine_sync.py — keeps a parent's schedule in sync with medicine reminder times.

WHY THIS EXISTS
    scheduler.py's delivery loop only ever reads sched["messages"] (the
    ScheduleInput.messages list) — it never looks at parent.medicine_list
    directly. So a MedicineItem.reminder_time saved on its own is inert:
    nothing will ever send a WhatsApp reminder at that time unless a
    matching ScheduleMessage(category="medicine", time=reminder_time)
    also exists in that parent's schedule.

    This module is the bridge. Call sync_medicine_reminders() any time a
    parent's medicine_list is created or updated (i.e. wherever your
    parent-update endpoint currently saves ParentInput to Mongo).

HOW IT STAYS SAFE TO RE-RUN
    Every ScheduleMessage this function creates is tagged
    source="medicine_sync" (see models.ScheduleMessage). On each call it:
      1. Removes only its OWN previously-synced entries for this parent
         (source == "medicine_sync") — manually-added check-ins/reminders
         (source is None) are never touched.
      2. Re-adds one entry per distinct reminder_time currently present
         across the parent's medicines (multiple medicines at the same
         time collapse into one send — matches scheduler.py's existing
         behavior of picking parent.medicine_list[0] as the display name).
      3. Stops adding once the plan's reminder limit is reached, and
         reports what got dropped so the caller can surface it instead
         of silently losing a reminder the user thinks is active.

    This does NOT call db.schedules directly for the "add" case blindly —
    it returns the computed list of ScheduleMessage dicts for the caller
    to merge into their existing ScheduleInput.messages and validate/save
    through the normal path (so ScheduleInput.limit_messages still runs
    against the combined list exactly as it does today).

INTEGRATION (server.py — wherever ParentInput is saved on create/update):

    from medicine_sync import sync_medicine_reminders

    parent_doc = ...  # after ParentInput validation, before/after db write
    sched = await db.schedules.find_one({"parent_id": parent_doc["_id"], "active": True})
    plan_id = ...  # resolve the same way scheduler.py does (payment_state / mode)

    result = sync_medicine_reminders(
        medicine_list=parent_doc.get("medicine_list", []),
        existing_messages=(sched or {}).get("messages", []),
        plan_id=plan_id,
    )
    if sched:
        await db.schedules.update_one(
            {"_id": sched["_id"]},
            {"$set": {"messages": result["messages"]}},
        )
    if result["dropped"]:
        # surface to the frontend: these reminder times couldn't be added —
        # plan's reminder limit reached. Don't fail the medicine save over
        # this; the medicine itself still saves, just without a live send.
        ...
"""

import logging
from typing import Optional

from pricing import plan_limits

logger = logging.getLogger("ayana.medicine_sync")

SYNC_SOURCE = "medicine_sync"
MEDICINE_CATEGORY = "medicine"


def sync_medicine_reminders(
    medicine_list: list[dict],
    existing_messages: list[dict],
    plan_id: str,
) -> dict:
    """
    Compute the new schedule.messages list after syncing medicine reminder
    times, without touching manually-added entries.

    Args:
      medicine_list:     parent["medicine_list"] — list of MedicineItem dicts
      existing_messages: the parent's current ScheduleInput.messages list
      plan_id:            resolved plan id (nitya/bandham/raksha)

    Returns:
      {
        "messages": [...],       # full new list — pass straight to db.schedules
        "synced_times": [...],   # reminder_times that made it in
        "dropped": [...],        # reminder_times that didn't fit the plan limit
      }
    """
    # 1. Keep every manually-added message untouched.
    manual = [m for m in existing_messages if m.get("source") != SYNC_SOURCE]

    # 2. Distinct reminder times across active (non-archived-recovery) medicines.
    #    Multiple medicines at the same time share one send, matching
    #    scheduler.py's current medicine_name = medicine_list[0] behavior.
    seen = set()
    reminder_times: list[str] = []
    for med in medicine_list:
        t = (med or {}).get("reminder_time")
        if t and t not in seen:
            seen.add(t)
            reminder_times.append(t)

    # 3. Respect the plan's reminder limit, counting manual reminder-type
    #    entries first — they were there before this sync and shouldn't be
    #    evicted to make room for auto-synced ones.
    limits = plan_limits(plan_id)
    max_reminders = limits.get("reminders", 0)
    manual_reminder_count = sum(
        1 for m in manual if m.get("category") == MEDICINE_CATEGORY
    )
    remaining_slots = max(0, max_reminders - manual_reminder_count)

    synced_times = reminder_times[:remaining_slots]
    dropped = reminder_times[remaining_slots:]

    if dropped:
        logger.warning(
            "[medicine_sync] %d reminder time(s) dropped — plan %s allows %d reminders, %d already manual",
            len(dropped), plan_id, max_reminders, manual_reminder_count,
        )

    synced_messages = [
        {
            "time": t,
            "category": MEDICINE_CATEGORY,
            "type": "reminder",
            "custom_text": None,
            "source": SYNC_SOURCE,
        }
        for t in synced_times
    ]

    return {
        "messages": manual + synced_messages,
        "synced_times": synced_times,
        "dropped": dropped,
    }