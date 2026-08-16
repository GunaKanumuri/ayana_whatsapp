"""
AYANA — WhatsApp interactive button_reply handler
---------------------------------------------------
Meta Cloud API webhook. When a parent taps a Quick Reply button
(Done/Skip on medicine, Yes/Not yet on meal), the incoming message
looks like this — NOT like a normal text message:

{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "91XXXXXXXXXX",
          "type": "interactive",
          "interactive": {
            "type": "button_reply",
            "button_reply": {
              "id": "medicine_done",   # you define this at template-approval time
              "title": "Done"
            }
          }
        }]
      }
    }]
  }]
}

This is unambiguous — no need to run it through keyword/NLP matching.
Route it directly.

INTEGRATION NOTES for whatsapp.py:
1. Find where you currently branch on message["type"] (likely "text" / "audio").
2. Add an "interactive" branch BEFORE falling through to keyword matching.
3. Wire `handle_interactive_reply()` in below, passing your existing
   db session / parent lookup / scheduler objects.
4. When you add buttons in WhatsApp Manager, set each button's payload
   id to match BUTTON_ACTION_MAP below (medicine_done, medicine_skip,
   meal_yes, meal_not_yet). Meta lets you set this at creation time —
   don't leave it as the auto-generated default, or this map won't match.
"""

from typing import Any, Optional
from enum import Enum


class ReplyAction(str, Enum):
    MEDICINE_DONE = "medicine_done"
    MEDICINE_SKIP = "medicine_skip"
    MEAL_YES = "meal_yes"
    MEAL_NOT_YET = "meal_not_yet"


# Maps the button's payload id (set when you create the template) to
# the internal action your scheduler/checkin logic already understands.
BUTTON_ACTION_MAP: dict[str, ReplyAction] = {
    "medicine_done": ReplyAction.MEDICINE_DONE,
    "medicine_skip": ReplyAction.MEDICINE_SKIP,
    "meal_yes": ReplyAction.MEAL_YES,
    "meal_not_yet": ReplyAction.MEAL_NOT_YET,
}


def is_interactive_button_reply(message: dict[str, Any]) -> bool:
    """True if this webhook message is a button tap, not free text/voice."""
    return (
        message.get("type") == "interactive"
        and message.get("interactive", {}).get("type") == "button_reply"
    )


def extract_button_payload(message: dict[str, Any]) -> Optional[str]:
    """Pull the button's payload id out of an interactive message."""
    return message.get("interactive", {}).get("button_reply", {}).get("id")


async def handle_interactive_reply(
    message: dict[str, Any],
    *,
    from_number: str,
    # pass your real dependencies in from whatsapp.py:
    mark_medicine_status,   # async fn(phone: str, taken: bool) -> None
    mark_meal_status,       # async fn(phone: str, eaten: bool) -> None
    send_whatsapp_text,     # async fn(phone: str, body: str) -> None
) -> bool:
    """
    Call this from your webhook handler BEFORE keyword matching runs.
    Returns True if the message was handled here (so the caller can
    `return`/`continue` instead of falling through to text parsing).
    """
    if not is_interactive_button_reply(message):
        return False

    payload_id = extract_button_payload(message)
    action = BUTTON_ACTION_MAP.get(payload_id)

    if action is None:
        # Unknown button id — log it, don't silently drop it.
        # e.g. logger.warning(f"Unrecognized button payload: {payload_id}")
        await send_whatsapp_text(
            from_number,
            "Sorry, I didn't recognize that. Could you reply with a quick text instead?",
        )
        return True

    if action == ReplyAction.MEDICINE_DONE:
        await mark_medicine_status(from_number, taken=True)
        await send_whatsapp_text(from_number, "Marked as done. 💛")

    elif action == ReplyAction.MEDICINE_SKIP:
        await mark_medicine_status(from_number, taken=False)
        await send_whatsapp_text(from_number, "Got it, marked as skipped today.")

    elif action == ReplyAction.MEAL_YES:
        await mark_meal_status(from_number, eaten=True)
        await send_whatsapp_text(from_number, "Great, noted!")

    elif action == ReplyAction.MEAL_NOT_YET:
        await mark_meal_status(from_number, eaten=False)
        await send_whatsapp_text(from_number, "Thanks — I'll check again a bit later.")

    return True


# ---------------------------------------------------------------------
# Example integration point (adapt to your actual webhook function):
#
# async def whatsapp_webhook(payload: dict):
#     for entry in payload.get("entry", []):
#         for change in entry.get("changes", []):
#             for message in change.get("value", {}).get("messages", []):
#                 from_number = message["from"]
#
#                 handled = await handle_interactive_reply(
#                     message,
#                     from_number=from_number,
#                     mark_medicine_status=mark_medicine_status,
#                     mark_meal_status=mark_meal_status,
#                     send_whatsapp_text=send_whatsapp_text,
#                 )
#                 if handled:
#                     continue
#
#                 # ... existing text/voice/keyword-matching flow below ...
# ---------------------------------------------------------------------