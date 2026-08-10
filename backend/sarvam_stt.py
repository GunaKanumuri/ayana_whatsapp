"""
sarvam_stt.py — Sarvam AI Speech-to-Text for AYANA voice note replies.

Flow:
  Parent taps button -> ButtonPayload -> no STT, instant intent
  Parent sends voice note -> Twilio MediaUrl -> Download with Basic Auth -> Sarvam STT -> transcript -> intent + emergency check

Unchanged from v1 except: callers (server.py's _record_reply) now also
pass the transcript through distress_detection.assess_transcript() for
the second ML layer + logging — see distress_detection.py.

Falls back gracefully when SARVAM_API_KEY missing.
"""

import logging
import os
import asyncio

import httpx

logger = logging.getLogger("ayana.stt")

_SARVAM_URL = "https://api.sarvam.ai/speech-to-text"
_TIMEOUT = 20.0

_LANG_MAP: dict[str, str] = {"en": "en-IN", "te": "te-IN", "hi": "hi-IN"}

VOICE_EMERGENCY_HINTS = {
    "te": ["నొప్పి", "బాలేదు", "పడిపోయా", "సహాయం", "అత్యవసరం", "ఒంట్లో బాలేదు", "తల తిరుగుతోంది", "గుండె నొప్పి"],
    "hi": ["दर्द", "गिर गया", "मदद", "सांस नहीं", "तबीयत खराब", "सीने में दर्द"],
    "en": ["pain", "fell", "help", "chest pain", "breathless", "emergency", "dizzy"],
}


def stt_enabled() -> bool:
    return bool(os.environ.get("SARVAM_API_KEY", "").strip())


async def transcribe_voice_note(media_url: str, language: str = "en", twilio_sid: str = "", twilio_token: str = "") -> str | None:
    api_key = os.environ.get("SARVAM_API_KEY", "").strip()
    endpoint = os.environ.get("SARVAM_STT_URL", _SARVAM_URL).strip()
    if not api_key:
        logger.info("[stt] SARVAM_API_KEY not set — skipping transcription for %s", media_url)
        return None

    sid = twilio_sid or os.environ.get("TWILIO_ACCOUNT_SID", "")
    token = twilio_token or os.environ.get("TWILIO_AUTH_TOKEN", "")

    audio_bytes = None
    content_type = "audio/ogg"
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                dl_resp = await client.get(media_url, auth=(sid, token) if sid and token else None, follow_redirects=True)
            if dl_resp.status_code == 200 and len(dl_resp.content) > 1000:
                audio_bytes = dl_resp.content
                content_type = dl_resp.headers.get("content-type", "audio/ogg")
                break
            await asyncio.sleep(1 * (attempt + 1))
        except Exception as exc:
            logger.warning("[stt] Download attempt %s error: %s", attempt + 1, exc)
            await asyncio.sleep(1 * (attempt + 1))

    if not audio_bytes:
        logger.error("[stt] Failed to download audio after 3 tries: %s", media_url)
        return None

    lang_code = _LANG_MAP.get(language, "en-IN")
    ext = _ext_from_content_type(content_type)
    filename = f"voice_note.{ext}"

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                endpoint,
                headers={"api-subscription-key": api_key},
                files={"file": (filename, audio_bytes, content_type)},
                data={"model": "saarika:v2.5", "language_code": lang_code, "with_timestamps": "false", "with_diarization": "false", "with_disfluencies": "false"},
            )
        if resp.status_code in (200, 201):
            data = resp.json()
            transcript = data.get("transcript", "").strip() or data.get("text", "").strip()
            if transcript:
                logger.info("[stt] Transcribed [%s] %s chars", lang_code, len(transcript))
                hints = VOICE_EMERGENCY_HINTS.get(language, []) + VOICE_EMERGENCY_HINTS["en"]
                low_trans = transcript.lower()
                for hint in hints:
                    if hint.lower() in low_trans:
                        logger.warning("[stt] Emergency hint matched in voice transcript")
                        break
                return transcript
            return None
        logger.error("[stt] Sarvam API error %s", resp.status_code)
        return None
    except httpx.TimeoutException:
        logger.error("[stt] Sarvam STT timed out for %s", media_url)
        return None
    except Exception as exc:
        logger.exception("[stt] Unexpected error: %s", exc)
        return None


def _ext_from_content_type(ct: str) -> str:
    ct = ct.split(";")[0].strip().lower()
    return {
        "audio/ogg": "ogg", "audio/ogg; codecs=opus": "ogg", "audio/mpeg": "mp3",
        "audio/mp4": "m4a", "audio/wav": "wav", "audio/x-wav": "wav",
        "audio/webm": "webm", "audio/amr": "amr", "audio/3gpp": "3gp", "audio/3gpp2": "3gp",
    }.get(ct, "ogg")


def transcribe_to_intent(transcript: str, language: str = "en") -> str:
    if not transcript:
        return "text"
    t = transcript.lower().strip()
    good_keywords = ["బాగున్నా", "బాగుంది", "bagunna", "bagundi", "good", "fine", "great", "ठीक हूँ", "अच्छा हूँ", "badhoon"]
    okay_keywords = ["ఫర్వాలేదు", "పర్వాలేదు", "parvaledu", "farvaledu", "okay", "ok", "theek", "ठीक-ठाक", "ठीक है"]
    bad_keywords = ["బాలేదు", "baledu", "బాగోలేదు", "bagoledu", "not well", "sick", "నొప్పి", "noppi", "दर्द", "तबीयत ठीक नहीं"]
    done_keywords = ["అయ్యింది", "ayyindi", "వేసుకున్నా", "vesukunna", "done", "हो गया", "ले लिया", "kha liya"]

    for kw in bad_keywords:
        if kw in t:
            return "feeling:not_well"
    for kw in good_keywords:
        if kw in t:
            return "feeling:good"
    for kw in okay_keywords:
        if kw in t:
            return "feeling:okay"
    for kw in done_keywords:
        if kw in t:
            return "done:generic"
    return "text"