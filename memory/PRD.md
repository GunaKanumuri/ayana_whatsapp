# AYANA — Product Requirements Document

> Last refreshed 2026-08-11, against branch `feat/enhancedv2`. Previous
> version of this doc was last touched 2026-07-08 and described the
> original 2-tier Basic/Care+ INR pricing — since fully replaced. Treat
> anything not in this file as unconfirmed; check the code before trusting
> old notes, including older entries left below for history.

## Original Problem Statement
A web-based family-care communication platform helping children living
away from parents stay emotionally connected via scheduled WhatsApp
check-ins, multilingual messaging (English/Telugu/Hindi), and trust-first
onboarding. Emotionally warm, privacy-first, timezone-safe.

## Architecture (as built)
- Frontend: React + Tailwind + shadcn/ui
- Backend: FastAPI (modular: server, auth, models, whatsapp, scheduler,
  templates_data, database, escalation, distress_detection, monthly_report,
  translation_engine)
- DB: MongoDB (motor)
- Auth: custom JWT (Bearer token)
- WhatsApp: Twilio, behind `WHATSAPP_ENABLED` (currently OFF — simulated)
- Payments: behind `PAYMENTS_ENABLED` (currently OFF)
- Scheduler jobs: delivery (1min), re-engagement (15min), care-watch (5min),
  recovery-expiry (24h), monthly-report (hourly, gated)

## Pricing (current)
Nitya $10 / Bandham $19 / Raksha $29 — USD-first currency list, INR
removed. See `pricing.py` for full limits table.

## Implemented and in code today
- Auth, onboarding wizard, dashboard (parents/schedules/replies/activity/
  reports/circle/care/account tabs), admin, legal pages
- Personalization: nicknames, habits, stories, city, other_parent_name,
  birthday (Onboarding only — not yet editable in Dashboard for
  nicknames/habits/stories; city/other_parent_name/birthday were added to
  the Dashboard edit dialog in this pass)
- Two-layer distress detection: keyword (always on) + Sarvam AI advisory
  classifier on voice transcripts (off by default)
- Monthly reports with mood graph (Bandham/Raksha)
- Emergency contacts (separate from Care Circle, max 5, E.164-validated)
- Two-way moments (child → parent WhatsApp note/photo)
- Care Watch escalation engine: unanswered-message retries, afternoon
  no-reply warning, birthday + festival auto-wishes
- Recovery mode (Raksha): extra reminder slots, archived (not deleted) on
  expiry

## Known gaps as of this refresh
1. Never tested against real WhatsApp — Twilio creds unset, flag off
2. 9 of 15 Twilio template SIDs were undocumented in `.env.example`
   (fixed) and none are submitted for Meta approval yet
3. CareTab.jsx (emergency contacts/moments/recovery UI) never click-tested
4. Dashboard parent-edit dialog still can't set nicknames/habits/stories
   for an existing parent
5. `backend/tests/test_ayana_api.py` has stale assertions against old
   plan ids / relationship casing — needs a full re-sync pass
6. Distress ML Layer 2 never exercised with a real API key + transcript
7. Monthly report → WhatsApp push (vs. dashboard-only) still undecided

See `README.md` for the fuller breakdown and file map.

---

## History (pre-2026-08-11 entries, unverified against current code)

### Implemented (2026-07-08)
- Auth: register/login/me/logout, admin seeding, JWT bearer
- Onboarding 5-step wizard, parents/schedules CRUD, consent logs
- Payment state (trial/test flag), Activation + WhatsApp instructions
- Multilingual static templates, WhatsApp inbound webhook + emergency detection
- Legal pages
- Verified: 24/24 backend pytest + full frontend E2E (100%) — at the time

### Iteration 2 (2026-07-08)
- Country-code phone inputs, conversational templates, two-pack pricing
  (Basic/Care+, since replaced by Nitya/Bandham/Raksha)
- WhatsApp LIVE via Twilio sandbox (verified real delivery at the time —
  current `.env` shows Twilio creds now blank again, status unclear)

### Iteration 4 (2026-07-08)
- Instant reply notifications, send-test check-in, family co-care invite
- Multilingual 3D landing rewrite
- Next (as of that entry): WhatsApp interactive template buttons, Meta
  Cloud API vs Twilio pricing decision, Sarvam AI, rotate Twilio token