# AYANA — WhatsApp-based closeness for NRI families & elderly parents

Branch: **`feat/enhancedv2`** — this is the live-development branch and the
one this README describes. `feat/version2` and `main` are older/behind;
don't treat them as current.

## What AYANA does today

A FastAPI + MongoDB backend sends scheduled, multilingual (EN/TE/HI)
WhatsApp check-ins to an elderly parent, on behalf of an adult child (NRI)
who configures everything from a React dashboard. Three pricing tiers —
**Nitya $10 / Bandham $19 / Raksha $29** — gate how many parents, daily
touches, nicknames, and features are available. See `pricing.py`.

## Feature set (backend-verified; see "What's not verified" below)

| Area | What it does | File(s) |
|---|---|---|
| Scheduled check-ins/reminders | 1-min delivery loop, per-parent timezone, rotating message variants (3–7 per slot/language) | `scheduler.py`, `templates_data.py`, `whatsapp.py` |
| Personalization | Nicknames (rotate daily), habits (tea/walk/wake/sleep), memory-prompt stories, `other_parent_name` ("did Amma have lunch too?"), city-driven seasonal greeting, birthday | `models.py`, `templates_data.py` |
| Distress detection | Layer 1: keyword matching (always on, free, fail-safe). Layer 2: Sarvam AI chat-completions as an advisory classifier on **voice transcripts only** — off by default (`DISTRESS_ML_ENABLED=false`), every transcript still logged to `distress_logs` for future fine-tuning | `distress_detection.py` |
| Monthly reports | Touch/delivery/voice-reply stats; Bandham/Raksha get a mood-over-time graph + trend note; Raksha fans out to both kids | `monthly_report.py` |
| Emergency contacts | Separate from Care Circle — up to 5 per parent, E.164-validated | `server.py` (`/parents/{id}/emergency-contacts`), `models.py` |
| Two-way moments | Child → parent warm note/photo, delivered via WhatsApp | `server.py` (`/moments`), `models.py` |
| **Care Watch** escalation engine | Runs every 5 min: retries unanswered medicine reminders (15-min cadence, up to 1h) and check-ins (30-min cadence, up to 1h); afternoon no-reply warning to child + Care Circle + emergency contacts (once/day); birthday + fixed/lunar festival auto-wishes (once/day) | `escalation.py`, wired into `scheduler.py` |
| Recovery mode (Raksha only) | User-set extra reminder slots for a period; archived (not deleted) on expiry via a daily job, one-tap re-enable | `server.py` (`/schedules/{id}/recovery/start`, `/end`), `scheduler.py` |
| Re-engagement | Per-schedule configurable window (`reengagement_hours`), same mechanism for all plans — no tier gets priority delivery | `whatsapp.py`, `scheduler.py` |

## File map

```
backend/
  server.py            — all API routes
  models.py             — Pydantic request/response models
  pricing.py             — Nitya/Bandham/Raksha plans, limits, pricing table
  templates_data.py       — message variants, seasonal_greeting(), nickname rotation
  whatsapp.py               — send logic, 15 Content template SIDs, retry-with-backoff
  scheduler.py               — delivery (1min) / re-engagement (15min) / care-watch (5min)
                                / recovery-expiry (24h) / monthly-report (hourly, gated) jobs
  escalation.py              — Care Watch engine (see table above)
  distress_detection.py     — two-layer emergency/mood detection
  monthly_report.py          — report generation + mood graph
  translation_engine.py       — AI translation layer
  sarvam_stt.py                — voice transcription
  auth.py, database.py, otp.py, email_sender.py

frontend/src/
  pages/Onboarding.js    — 5-step wizard (child → parent → plan → schedule → activate)
  pages/Dashboard.js      — parents/schedules/replies/activity/reports/circle/care/account tabs
  components/CareTab.jsx   — emergency contacts + moments + recovery mode UI
```

## What's NOT done / verified — read before you assume it works

1. **Nothing has been tested against real WhatsApp.** `WHATSAPP_ENABLED=false`
   and every `TWILIO_*` credential in `.env` is blank. Every "PASSED" in
   `test_result.md`, including all of Care Watch/moments/emergency
   contacts, was verified in simulated-send mode only.
2. **`.env.example` was missing 9 of the 15 required Twilio template SIDs**
   (medicine/meal/mood, all 3 languages) — fixed, but nobody has actually
   submitted these for Meta template approval yet. Without approval, any
   send outside the 24h session window for those categories will fail.
3. **CareTab.jsx (emergency contacts, moments, recovery mode) has never
   been click-tested.** The testing agent hit the backend routes directly
   with HTTP requests, not through the UI, and was explicitly told not to
   test this tab or login.
4. **Dashboard "Edit parent" dialog was missing `city`, `other_parent_name`,
   and `birthday`** (present in Onboarding but not editable afterward) —
   fixed in this pass. `nicknames`, `habits`, and `stories` are still
   Onboarding-only; there's no way to add/edit them for an existing parent
   from the Dashboard yet.
5. **Blank-birthday 422 bug** — the frontend sends `birthday: ""` when the
   optional date picker is left empty; the backend regex validator was
   rejecting that instead of treating it as "not set." Fixed with a
   `mode="before"` validator that maps `""` → `None`; regression test
   added in `backend/tests/test_ayana_api.py`.
6. **`backend/tests/test_ayana_api.py` is stale relative to the current
   models** — e.g. it POSTs `relationship: "Mother"` / `"Grandmother"`,
   but `ParentInput.relationship` only accepts lowercase `mother|father`.
   Those existing tests would currently fail if run; needs a pass to
   re-sync the whole suite with the live models, not just the one method
   patched here.
7. **Distress ML (Layer 2) has a real Sarvam integration now**, not a stub
   — but it's off by default and has never been exercised end-to-end with
   a live `SARVAM_API_KEY` and a real transcript.
8. **Monthly report WhatsApp push** — reports currently only land in
   `db.monthly_reports` for the dashboard to fetch. Whether they should
   *also* push as a 6th approved WhatsApp template to the child is still
   an open decision.

## Environment variables

See `backend/.env.example` — now includes all 15 Twilio template SIDs and
the distress-ML vars, both previously undocumented.