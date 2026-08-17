# AYANA — WhatsApp-based closeness for NRI families & elderly parents

Branch: **`feat/phase2`** — this is the live-development branch and the
one this README describes. `feat/version2` and `main` are older/behind;
don't treat them as current.

## What AYANA does today

A FastAPI + MongoDB backend sends scheduled, multilingual (EN/TE/HI)
WhatsApp check-ins to an elderly parent, on behalf of an adult child (NRI)
who configures everything from a React dashboard. Three pricing tiers —
**Nitya $10 / Bandham $19 / Raksha $29** — gate how many parents, daily
touches, nicknames, and features are available. See `pricing.py`.

## Feature set (backend-verified)

| Area | What it does | File(s) |
|---|---|---|
| Scheduled check-ins/reminders | 1-min delivery loop, per-parent timezone, rotating message variants (3–7 per slot/language) | `scheduler.py`, `templates_data.py`, `whatsapp.py` |
| **Send-time activity window** | Messages are deferred if sent outside the parent's typical active hours. Window is auto-learned from historical reply patterns OR manually set on the parent profile. Prevents nagging during temple visits, market trips, sleep hours. | `models.py` (new fields), `scheduler.py` (send-time check) |
| Personalization | Nicknames (rotate daily), habits (tea/walk/wake/sleep), memory-prompt stories, `other_parent_name` ("did Amma have lunch too?"), city-driven seasonal greeting, birthday | `models.py`, `templates_data.py` |
| Distress detection | Layer 1: keyword matching (always on, free, fail-safe). Layer 2: Sarvam AI chat-completions as an advisory classifier on **voice transcripts only** — off by default (`DISTRESS_ML_ENABLED=false`), every transcript still logged to `distress_logs` for future fine-tuning | `distress_detection.py` |
| Monthly reports | Touch/delivery/voice-reply stats; Bandham/Raksha get a mood-over-time graph + trend note; Raksha fans out to both kids. **Auto-triggered on the 1st of every month** via scheduler job. Pushes a "report_ready" WhatsApp template to the child (and Care Circle for Raksha) with a deep-link to the dashboard. | `monthly_report.py`, `scheduler.py` |
| Emergency contacts | Separate from Care Circle — up to 5 per parent, E.164-validated | `server.py` (`/parents/{id}/emergency-contacts`), `models.py` |
| Two-way moments | Child → parent warm note/photo, delivered via WhatsApp | `server.py` (`/moments`), `models.py` |
| **Say-hi preview** | Child can send a warm greeting to a parent before full daily activation — "your child has set up AYANA, you'll start getting check-ins tomorrow". Uses a localized plain-text send. | `server.py` (`POST /parents/{id}/say-hi`) |
| **Care Watch** escalation engine | Runs every 5 min: retries unanswered check-ins AND medicine reminders on a unified **30-min cadence for up to 2 hours** (4 sends total). Afternoon no-reply warning to child + Care Circle + emergency contacts (once/day). Birthday + fixed/lunar festival auto-wishes (once/day). | `escalation.py`, wired into `scheduler.py` |
| Recovery mode (Raksha only) | User-set extra reminder slots for a period; archived (not deleted) on expiry via a daily job, one-tap re-enable | `server.py` (`/schedules/{id}/recovery/start`, `/end`), `scheduler.py` |
| Re-engagement | Per-schedule configurable window (`reengagement_hours`), same mechanism for all plans — no tier gets priority delivery | `whatsapp.py`, `scheduler.py` |
| **Interactive button routing** | Structured button taps (Done/Skip on medicine, Yes/Not yet on meals) are routed through the dedicated `interactive_button_handler.py` engine with callback hooks for status updates. Falls back to generic intent resolution for template buttons. | `server.py` (webhook handler), `interactive_button_handler.py` |
| **Delivery fallback & retry** | If a WhatsApp template send fails after all retries (e.g. error 21008 template rejected, phone unreachable), automatically falls back to a plain-text send so the parent definitely gets the message. Recheck interval is configurable. | `whatsapp.py` (`_send_content_template_with_retry`) |
| **Parent language auto-detect** | On first inbound reply, the system detects whether the parent responded in Telugu or Hindi script vs. their configured language. If mismatched, a suggestion is stored on the parent record and surfaced in the Dashboard — the child can accept the change with one click. | `server.py` (`_detect_language`, `GET /parents/{id}/language-suggestion`, `PUT /parents/{id}/language`) |

## File map

```
backend/
  server.py            — all API routes (auth, parents, schedules, moments, circle, webhook, admin)
  models.py             — Pydantic request/response models (includes activity_window fields)
  pricing.py             — Nitya/Bandham/Raksha plans, limits, pricing table
  templates_data.py       — message variants, seasonal_greeting(), nickname rotation
  whatsapp.py               — send logic, 6 Meta-approved template names, retry-with-backoff + delivery fallback
  scheduler.py               — delivery (1min) / re-engagement (15min) / care-watch (5min)
                                / recovery-expiry (24h) / monthly-report (24h) jobs
  escalation.py              — Care Watch engine (30-min retry cadence, 2hr window)
  distress_detection.py     — two-layer emergency/mood detection
  monthly_report.py          — report generation + mood graph + report_ready WhatsApp push
  translation_engine.py       — AI translation layer
  sarvam_stt.py                — voice transcription
  interactive_button_handler.py — structured button tap router for quick-replies
  auth.py, database.py, otp.py, email_sender.py

frontend/src/
  lib/api.js             — Axios instance, Bearer token, error formatting. ONLY way frontend talks to backend
  pages/Onboarding.js    — 5-step wizard (child → parent → plan → schedule → activate)
  pages/Dashboard.js      — parents/schedules/replies/activity/reports/circle/care/account tabs
  components/CareTab.jsx   — emergency contacts + moments + recovery mode UI
  lib/fallbackPlans.js    — client-side mirror of pricing tiers for zero-latency render
```

## What's NOT done / verified — read before you assume it works

1. **Nothing has been tested against real WhatsApp.** `WHATSAPP_ENABLED=false`
   and all `META_WA_*` credentials in `.env` are blank. Every "PASSED" in
   `test_result.md`, including all of Care Watch/moments/emergency
   contacts, was verified in simulated-send mode only.
2. **Meta template approval** — the 6 templates (`ayana_opener`, `ayana_medicine`,
   `ayana_meal`, `ayana_mood`, `ayana_reengager`, `ayana_report_ready`) are referenced
   by name in `_CATEGORY_TEMPLATE_NAME`. They must be submitted & approved in the
   Meta Business Manager before any out-of-session message will send. The `send_test`
   API and Onboarding UI work in simulation mode regardless.
3. **CareTab.jsx (emergency contacts, moments, recovery mode) has never
   been click-tested.** The testing agent hit the backend routes directly
   with HTTP requests, not through the UI.
4. **Dashboard "Edit parent" dialog** still lacks inline fields for `nicknames`,
   `habits`, and `stories` — those are Onboarding-only. The new `activity_window`
   fields, birthday, city, and `other_parent_name` are editable there.
5. **Blank-birthday 422 bug** — fixed with a `mode="before"` validator in `models.py`
   that maps `""` → `None`; regression test added in `backend/tests/test_ayana_api.py`.
6. **`backend/tests/test_ayana_api.py` is stale relative to the current
   models** — e.g. it POSTs `relationship: "Mother"` / `"Grandmother"`,
   but `ParentInput.relationship` only accepts lowercase `mother|father`.
   Those tests would fail if run; needs a full re-sync pass.
7. **Distress ML (Layer 2) has a real Sarvam integration** — off by default
   (`DISTRESS_ML_ENABLED=false`) and never exercised end-to-end with a live key.
8. **Monthly report WhatsApp push** — now **enabled by default** (`AUTO_MONTHLY_REPORTS=true`)
   and pushes `ayana_report_ready` to the child on the 1st of each month. The report
   deep-link points to `{FRONTEND_URL}/reports/{parent_id}/{period}` — confirm that route
   exists in the frontend Dashboard.

## Environment variables

See `backend/.env.example` — includes all 6 Meta template names and the
distress-ML vars.

### New / changed env vars (this pass)

| Variable | Default | Purpose |
|---|---|---|
| `WHATSAPP_ENABLED` | `false` | Master toggle for all Meta WA sends |
| `AUTO_MONTHLY_REPORTS` | `true` (was `false`) | Enables the daily scheduler job that fires on the 1st of the month |
| `WA_DELIVERY_RECHECK_MIN` | `5` | Minutes to wait before falling back to plain-text on a failed send |
| `WA_DELIVERY_FALLBACK` | `true` | Enable/disable the plain-text fallback after template send failure |

## Architecture notes

- **Frontend ↔ Backend**: Strictly API-only. The frontend imports only from
  `lib/api.js`, which wraps all requests with Axios + Bearer JWT. No shared
  modules, no direct database access, no Python imports. Plan data is mirrored
  client-side in `fallbackPlans.js` for instant render, but all mutations
  (schedule, parent edits, payments) are validated against `pricing.py` on the
  server.
- **Distributed scheduler lock**: APScheduler runs in-process in every API replica.
  Each job is wrapped in `_with_lock()` which uses a short-lived Mongo doc with a
  TTL index. Only one replica wins the lock per tick — prevents duplicate WhatsApp
  sends and double Meta billing. If a lock holder crashes, TTL expires the lock.
