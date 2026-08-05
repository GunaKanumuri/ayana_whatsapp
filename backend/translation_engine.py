"""
translation_engine.py — On-demand, cached AI translation of AYANA's
message-template variants into languages beyond the static en/te/hi set.

WHY THIS EXISTS
The v2 SLOT_VARIANTS dict in templates_data.py hardcodes ~7 handwritten
variants x 15 categories x 3 languages (en/te/hi). That's the right
choice for the 3 launch languages — zero latency, zero AI cost, full
editorial control over tone (the nicknames/habits/season placeholders
need to read naturally, not like a literal translation). But it means
adding language #4 (e.g. Kannada, Tamil, Malayalam, Bengali for other
NRI-heavy states) previously meant a code change + redeploy + manually
writing ~100+ template strings by hand.

This module makes that adaptable: given the English source variants for
a category, it asks Sarvam's LLM (already an integrated vendor — same
SARVAM_API_KEY as sarvam_stt.py / distress_detection.py) to localize
them into the target language, preserving the {placeholder} tokens
exactly. The result is cached FOREVER in `db.template_cache` keyed by
(category, language) — so the AI call happens once per category per
language, ever, not once per message. A household's 6 daily messages
over a year is ~2,200 messages; with caching that's still just 1 AI
call per category (15 total) the first time anyone requests that
language, not 2,200.

TOKEN OPTIMIZATION
  - One batched call per CATEGORY (all variants at once), not one call
    per variant — cuts call count ~7x vs. a naive per-variant loop.
  - max_tokens kept tight (variants are short WhatsApp lines).
  - reasoning disabled (reasoning_effort=None) — this is a translation
    task, not a reasoning task, and voice/webhook-adjacent calls in this
    codebase already follow that pattern (see distress_detection.py).
  - Cache lookups happen before any network call — the fast path for
    en/te/hi never touches this module at all (see
    templates_data.render_slot_body_async).

FAIL-SAFE
If Sarvam is unavailable, unconfigured, or returns something we can't
parse, this returns the ENGLISH variants rather than raising — a
family talking to their parent in English-as-fallback is a much better
failure mode than a crashed scheduler job or a blank WhatsApp message.
"""

import json
import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger("ayana.translation")

_SARVAM_CHAT_URL = os.environ.get("SARVAM_CHAT_URL", "https://api.sarvam.ai/v1/chat/completions")
_MODEL = os.environ.get("TRANSLATION_SARVAM_MODEL", "sarvam-30b")
_TIMEOUT = 15.0

_SYSTEM_PROMPT = (
    "You localize short WhatsApp check-in messages for elderly parents in India, "
    "written by their adult children living abroad. Keep the warm, casual, "
    "affectionate tone of the English originals — this is not a formal or literal "
    "translation, it's how a loving son or daughter would actually text in this "
    "language. CRITICAL: every {placeholder} token (e.g. {nick1}, {city}, {season}, "
    "{medicine}, {tea_type}, {other_parent}) must appear in your output EXACTLY as "
    "written, unchanged — these are filled in by code afterward. Keep emoji. Keep "
    "each line short enough for a WhatsApp message. Respond only with the requested JSON."
)


def _response_schema(n: int) -> dict:
    return {
        "type": "object",
        "properties": {
            "variants": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": n,
                "maxItems": n,
            },
        },
        "required": ["variants"],
        "additionalProperties": False,
    }


async def translate_category_variants(
    category: str,
    language: str,
    language_label: str,
    english_variants: list[str],
) -> list[str]:
    """
    Localizes ALL variants for one category into `language` in a single
    call. Returns the English originals unchanged on any failure —
    never raises.
    """
    if not english_variants:
        return english_variants

    api_key = os.environ.get("SARVAM_API_KEY", "").strip()
    if not api_key:
        logger.info("[translate] SARVAM_API_KEY not set — falling back to English for %s/%s", category, language)
        return english_variants

    n = len(english_variants)
    numbered = "\n".join(f"{i+1}. {v}" for i, v in enumerate(english_variants))
    user_prompt = (
        f"Localize these {n} English WhatsApp message variants for the '{category}' "
        f"check-in category into {language_label}. Return exactly {n} variants, in the "
        f"same order:\n\n{numbered}"
    )

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                _SARVAM_CHAT_URL,
                headers={"api-subscription-key": api_key, "Content-Type": "application/json"},
                json={
                    "model": _MODEL,
                    "messages": [
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 800,
                    "reasoning_effort": None,
                    "response_format": {
                        "type": "json_schema",
                        "json_schema": {"name": "localized_variants", "schema": _response_schema(n), "strict": True},
                    },
                },
            )
        if resp.status_code not in (200, 201):
            logger.warning("[translate] Sarvam error %s for %s/%s: %.200s", resp.status_code, category, language, resp.text)
            return english_variants
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        variants = parsed.get("variants") or []
        if len(variants) != n:
            logger.warning("[translate] Variant count mismatch for %s/%s (%d != %d) — using English", category, language, len(variants), n)
            return english_variants
        # Sanity check: every placeholder token in the English source must
        # survive translation unchanged, or we silently fall back — a
        # dropped {nick1} would render as a literal "{nick1}" in a live
        # WhatsApp message to someone's parent, which is worse than English.
        import re
        for src, out in zip(english_variants, variants):
            src_tokens = set(re.findall(r"\{[a-z_0-9]+\}", src))
            out_tokens = set(re.findall(r"\{[a-z_0-9]+\}", out))
            if src_tokens != out_tokens:
                logger.warning("[translate] Placeholder mismatch for %s/%s — using English for that variant", category, language)
                return english_variants
        return variants
    except httpx.TimeoutException:
        logger.warning("[translate] Sarvam call timed out for %s/%s — using English", category, language)
        return english_variants
    except Exception as e:
        logger.warning("[translate] Translation failed for %s/%s: %s — using English", category, language, e)
        return english_variants