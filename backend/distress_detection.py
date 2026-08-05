"""
distress_detection.py — Two-layer emergency/mood detection for AYANA.

Layer 1 (always on, instant, free): keyword matching via
whatsapp.detect_emergency() — catches explicit distress words in any
language. This never goes away; it's the fail-safe floor.

Layer 2 (voice transcripts only): Sarvam AI's chat-completions endpoint
(sarvam-30b) used as a distress classifier — catches the case your own
research flagged: a parent saying "బాగుంది" (fine) while actually
struggling. Sarvam was chosen over a generic sentiment API because (a)
it's already an integrated vendor here (SARVAM_API_KEY, same as
sarvam_stt.py) so this adds no new dependency, and (b) transcripts are
often code-mixed Telugu/Hindi/English + transliteration, which a
fixed-vocabulary sentiment classifier handles poorly but an LLM prompted
in-language handles natively. This is NOT a custom-trained model —
there's no labeled data yet. It's an off-the-shelf model used as a
second opinion, called with reasoning disabled (reasoning_effort=None)
to keep latency down since voice replies are time-sensitive.

Every transcript + both layers' verdicts is logged to `distress_logs`
regardless of outcome. That log is the training set for a future
fine-tuned model — once there's enough real volume, swap
_pretrained_distress_score() for a purpose-built classifier without
changing anything else in this file's interface.

This module deliberately does NOT try to infer distress from tap-button
choices (feeling:good/okay/not_well) — those are the parent's stated
answer and are taken at face value. The gap this fills is specifically
in free text / voice, where nuance can hide behind a "fine."
"""

import logging
import os
import json
from datetime import datetime, timezone
from typing import Optional

import httpx

logger = logging.getLogger("ayana.distress")

DISTRESS_ML_ENABLED = os.environ.get("DISTRESS_ML_ENABLED", "false").strip().lower() == "true"

_SARVAM_CHAT_URL = os.environ.get("SARVAM_CHAT_URL", "https://api.sarvam.ai/v1/chat/completions")
_SARVAM_MODEL = os.environ.get("DISTRESS_SARVAM_MODEL", "sarvam-30b")  # 64K context is plenty for one transcript
_TIMEOUT = 8.0  # keep tight — this runs inline in the webhook reply path

_LANG_NAME = {"en": "English", "te": "Telugu", "hi": "Hindi"}

_SYSTEM_PROMPT = (
    "You assess short voice-message transcripts from elderly parents in India, sent to "
    "their adult children via a WhatsApp check-in app. Parents often say they are 'fine' "
    "out of politeness or to avoid worrying their children, even when something is wrong. "
    "Read the transcript (it may mix English with transliterated or native-script Telugu "
    "or Hindi) and judge how likely it is that the speaker is actually distressed, in pain, "
    "lonely, or unwell, independent of the literal words used. Respond only with the "
    "requested JSON."
)

_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "distress_likelihood": {
            "type": "number",
            "description": "0.0 (clearly fine) to 1.0 (clearly distressed)",
        },
    },
    "required": ["distress_likelihood"],
    "additionalProperties": False,
}


async def _pretrained_distress_score(transcript: str, language: str) -> Optional[float]:
    """
    Returns a 0.0-1.0 distress likelihood from Sarvam's chat-completions
    endpoint used as a zero-shot classifier, or None if unavailable/disabled.
    Must never raise — always return None on failure so the keyword layer
    remains the source of truth.
    """
    if not DISTRESS_ML_ENABLED or not transcript:
        return None
    api_key = os.environ.get("SARVAM_API_KEY", "").strip()
    if not api_key:
        logger.info("[distress] DISTRESS_ML_ENABLED but SARVAM_API_KEY not set — skipping ML layer")
        return None

    lang_name = _LANG_NAME.get(language, "English")
    user_prompt = f"Transcript (spoken in {lang_name}): \"{transcript}\""

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                _SARVAM_CHAT_URL,
                headers={"api-subscription-key": api_key, "Content-Type": "application/json"},
                json={
                    "model": _SARVAM_MODEL,
                    "messages": [
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.1,
                    "max_tokens": 100,
                    "reasoning_effort": None,  # disable thinking mode — latency-sensitive path
                    "response_format": {
                        "type": "json_schema",
                        "json_schema": {"name": "distress_assessment", "schema": _RESPONSE_SCHEMA, "strict": True},
                    },
                },
            )
        if resp.status_code not in (200, 201):
            logger.warning("[distress] Sarvam chat API error %s: %.200s", resp.status_code, resp.text)
            return None
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        score = float(parsed["distress_likelihood"])
        return max(0.0, min(1.0, score))
    except httpx.TimeoutException:
        logger.warning("[distress] Sarvam chat call timed out — falling back to keywords only")
        return None
    except Exception as e:
        logger.warning("[distress] ML layer failed, falling back to keywords only: %s", e)
        return None


async def assess_transcript(
    db,
    parent_id,
    transcript: str,
    language: str,
    keyword_matches: list[str],
) -> dict:
    """
    Runs both layers on a voice transcript and logs the result for
    future fine-tuning. Returns a dict the caller can use to decide
    whether to raise an emergency event.
    """
    ml_score = await _pretrained_distress_score(transcript, language)

    is_keyword_emergency = bool(keyword_matches)
    is_ml_flagged = ml_score is not None and ml_score >= 0.7

    log_entry = {
        "parent_id": parent_id,
        "transcript": transcript,
        "language": language,
        "keyword_matches": keyword_matches,
        "ml_score": ml_score,
        "keyword_emergency": is_keyword_emergency,
        "ml_flagged": is_ml_flagged,
        "outcome": None,  # filled in later if/when a human confirms — the actual training label
        "created_at": datetime.now(timezone.utc),
    }
    try:
        await db.distress_logs.insert_one(log_entry)
    except Exception as e:
        logger.error("[distress] Failed to log transcript assessment: %s", e)

    return {
        "keyword_emergency": is_keyword_emergency,
        "ml_flagged": is_ml_flagged,
        "ml_score": ml_score,
    }