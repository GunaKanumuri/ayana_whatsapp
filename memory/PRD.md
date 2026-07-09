# AYANA-BOT — Product Requirements Document

## Original Problem Statement
A web-based family-care communication platform helping children living away from parents stay emotionally connected via scheduled WhatsApp check-ins, multilingual messaging (English/Telugu/Hindi), and trust-first onboarding. Emotionally warm, privacy-first, timezone-safe.

## Architecture (as built)
- Frontend: React 19 + React Router 7 + Tailwind + shadcn/ui + framer-motion
- Backend: FastAPI (modular: server, auth, models, whatsapp, scheduler, templates_data, database)
- DB: MongoDB (motor). Auth: custom JWT (Bearer token in localStorage `ayana_token`)
- WhatsApp: Twilio, behind `WHATSAPP_ENABLED` flag (currently OFF -> messages simulated & logged)
- Payments: behind `PAYMENTS_ENABLED` flag (currently OFF -> checkout skipped, trial granted)
- Scheduler: APScheduler runs every minute; uses PARENT timezone as source of truth to deliver due messages

## User Personas
- Primary: adult children (NRIs, professionals) living away from parents
- Secondary: elderly parents receiving warm check-ins in their language
- Admin: internal team monitoring onboarding/activation/deliveries

## Core Requirements (static)
- Emotional landing (hero, how it works, why supported, multilingual, privacy, FAQ, CTA)
- Auth (email+phone signup), onboarding wizard, dashboard, admin, legal pages
- Consent logging, timezone-safe scheduling, emergency keyword detection design
- Privacy-first: soft-delete, delete-account, audit logs, webhook signature verification

## Implemented (2026-07-08)
- Auth: register/login/me/logout, admin seeding, JWT bearer
- Onboarding 5-step wizard: child profile -> parent -> schedule (normal 5 / care+ 10) -> payment (disabled) -> activation
- Parents CRUD, Schedules CRUD + active toggle, consent logs, preferences
- Payment state (trial/test flag), Activation + WhatsApp instructions/deep links
- Multilingual static templates (EN/TE/HI, 9 categories), message preview & delivery logs
- WhatsApp inbound webhook w/ signature verification + emergency event detection
- Advanced admin dashboard (stats, users, deliveries, emergencies)
- Legal: Privacy, Terms, Disclaimer
- Verified: 24/24 backend pytest + full frontend E2E (100%)

## Backlog / Remaining
- P1: Go live on WhatsApp (add Twilio Sandbox creds, flip WHATSAPP_ENABLED=true)
- P1: Swap static templates for Sarvam AI translation layer
- P2: Enable payments (Stripe/Razorpay) via feature flag
- P2: Voice-note reply capture surfaced to dashboard; daily summary reports
- P2: Emergency escalation contacts config; email (Resend) notifications
- P3: Phone OTP verification at signup

## Next Tasks
- Confirm final pricing numbers (currently Basic ₹149 / Care+ ₹399, monthly+yearly, 8 currencies)

## Implemented (2026-07-08) — Iteration 2
- Country-code dropdown phone inputs everywhere (signup, onboarding, dashboard)
- Conversational, warm multilingual templates (casual EN/TE/HI) with per-message reply-options footer (1/2/3 + hold 🎤 voice note); variants rotate daily
- Two packs: Basic (3 check-ins + 2 reminders, 2 parents) & Care+ (10+10, 3 family members); monthly/yearly + 8 currencies; plan-based schedule limits enforced backend + UI
- Redesigned responsive schedule editor split into Daily check-ins vs Medicine & health reminders (shadcn Select, no overflow)
- Onboarding reordered: child → parent → choose plan → schedule → activate
- Activation how-to-reply guide + training-video slot (TRAINING_VIDEO_URL env)
- WhatsApp LIVE via Twilio sandbox (verified real delivery); theme polish (warm radial backgrounds)
- Verified: 30/30 backend pytest + frontend E2E

## Deferred / discuss
- Pill colour & medicine-type selection (next phase)
- Sarvam AI translation swap; enable real payments (Stripe/Razorpay)
- Family-member invite flow (Care+ co-care); production WhatsApp sender (Meta approval)

## Iteration 4 (2026-07-08)
- Instant reply notifications (parse 1/2/3 + voice + emergency in EN/TE/HI) → WhatsApp ping to child+family; Replies tab + Simulate demo
- Send-test check-in per parent (LIVE delivery verified)
- Care+ family co-care invite flow (household_owner_id + scope) — BUILT
- Complete multilingual 3D landing rewrite (react-three-fiber room→phone→globe; EN/TE/HI switch; terracotta/teal; Cormorant+Noto). 52/52 backend + frontend 100%
- Next: WhatsApp interactive template buttons (Meta approval); Meta Cloud API vs Twilio pricing decision; Sarvam AI; rotate Twilio token
