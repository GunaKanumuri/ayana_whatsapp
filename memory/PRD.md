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
- Collect Twilio WhatsApp Sandbox credentials from user to enable live sending
