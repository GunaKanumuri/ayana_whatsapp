# AYANA v2 — Nitya / Bandham / Raksha redesign

This package contains the redesigned backend for AYANA: a WhatsApp-based
closeness app for NRI families with elderly parents in India. It builds on
the original `ayana_whatsapp` backend (auth, parents, schedules, circle
invites, OTP, admin — all unchanged) and replaces the pricing, message
template, and detection layers per the agreed redesign.

## What changed from v1

| Area | v1 | v2 |
|---|---|---|
| Packages | Basic ($10-ish) / Care+ (2 tiers) | **Nitya $10 / Bandham $19 / Raksha $29** — see `pricing.py` |
| Kids in Care Circle | 0 / 3 | **1 / 1 / 2** |
| Daily touches | 5 / 20 | **4 (2+2) / 6 (3+3) / 7-8 (4+3-4)** |
| Personalization | 1 preferred_name only | **2-3 nicknames, rotate daily; 3 or 7 message variants/slot by plan** |
| Spouse field | `spouse_name` (confusing for unmarried users) | **removed** — only `other_parent_name` / "Amma had lunch?" |
| Season | static "చల్లగా ఉందా" | `seasonal_greeting()` — driven by month |
| Emergency/mood detection | keyword-only | **keyword (fail-safe) + pretrained ML layer on voice transcripts**, with every transcript logged for future fine-tuning |
| Report | none built | **Monthly** (not daily — real-time already happens via WhatsApp replies); Nitya gets counts, Bandham/Raksha get a mood graph + trend note, Raksha fans out to both kids |
| Retry on send failure | none | **uniform across all 3 plans** — no tier gets preferential treatment |
| Re-engagement window | static `REENGAGEMENT_HOURS` env var | **user-configurable per schedule** (`reengagement_hours`), same mechanism for every plan |
| Recovery mode (Raksha) | n/a | extra reminder slots for a user-set period; **archived, not deleted**, when it expires — one-tap to re-enable |

## File map

```
backend/
  pricing.py              — Nitya/Bandham/Raksha plans, limits, pricing table
  models.py                — Pydantic models: nicknames, habits, stories,
                              other_parent_name, reengagement_hours, recovery_mode
  templates_data.py        — SLOT_VARIANTS (3-7 per category/language),
                              seasonal_greeting(), nickname rotation,
                              render_slot_body(), tap-only buttons
  whatsapp.py               — sending logic: 5 approved Content templates,
                              in-session free quick-replies, retry-with-backoff
  scheduler.py               — 1-min delivery job, 15-min re-engagement job,
                              24h recovery-expiry job (archives, doesn't delete)
  distress_detection.py    — NEW: two-layer emergency/mood detection
  monthly_report.py         — NEW: monthly report generation + mood graph
  sarvam_stt.py              — voice transcription (unchanged interface)
  auth.py, database.py, otp.py, email_sender.py  — copied through unchanged
  server_v2_changes.py       — merge guide for your existing server.py
  requirements.txt
```

**Frontend was not rebuilt in this pass** — the React app's forms
(nicknames, habits, stories, heartbeat builder, recovery toggle, monthly
report view) still need building against the new API shapes described in
`server_v2_changes.py`. That's the next chunk of work.

## Why keyword detection is still the fail-safe

Your own research (Reddit/Instagram threads on NRI parent loneliness)
surfaced that parents often say "fine" while masking real distress.
Keyword matching alone can't catch that — but there's no labeled training
data yet to build a custom classifier either. So `distress_detection.py`:

1. Always runs keyword matching first (instant, free, zero-risk fail-safe).
2. Optionally runs a pretrained multilingual sentiment/distress model on
   **voice transcripts only** (never on tap-button choices — those are
   taken at face value) as a second, advisory signal.
3. Logs every transcript + both layers' verdicts to `distress_logs`,
   which becomes the training set for a future fine-tuned model once
   there's real volume. Swap `_pretrained_distress_score()` for the
   fine-tuned model later without touching any caller.

This is disabled by default (`DISTRESS_ML_ENABLED=false`) since no
provider is wired up yet — it's a stub integration point, not a working
model call. Keyword detection alone is fully functional today.

## Open items before this ships

1. **Report delivery channel** — reports currently land in
   `db.monthly_reports` for the frontend to fetch. Whether they should
   *also* be pushed as a WhatsApp message to the child (a 6th approved
   template) is still an open decision — see `server_v2_changes.py` §6.
2. **Pretrained distress model choice** — `distress_detection.py` has a
   stub integration point (`_pretrained_distress_score`). Needs a
   provider decision before `DISTRESS_ML_ENABLED=true` does anything.
3. **Frontend rebuild** — nicknames/habits/stories forms, the heartbeat
   builder with recovery toggle, and the monthly report view (with mood
   graph) all need to be built against the new models.
4. **Twilio Content template approval** — the 5 approved templates
   (opener/medicine/meal/mood/reengagement) need their copy re-approved
   with Meta if the underlying `{{2}}` body text changed meaningfully
   from what's currently live.

## Environment variables

Same as v1, plus:

```
DISTRESS_ML_ENABLED=false   # flip true once a provider is wired into distress_detection.py
```

All 15 Twilio ContentSid env vars (`TWILIO_OPENER_SID_EN/TE/HI`, etc.),
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`,
`SARVAM_API_KEY`, `MONGO_URL`, `DB_NAME`, `JWT_SECRET` — unchanged from v1.
