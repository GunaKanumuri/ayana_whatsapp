# AYANA — WhatsApp-based closeness for NRI families & elderly parents

Branch: **`feat/otp`** — this is the live-development branch and the one this README describes. `feat/phase2`, `feat/version2` and `main` are older/behind; don't treat them as current.

## What AYANA does today

A FastAPI + MongoDB backend sends scheduled, multilingual (EN/TE/HI) WhatsApp check-ins to an elderly parent, on behalf of an adult child (NRI) who configures everything from a React dashboard. Three pricing tiers — **Nitya $10 / Bandham $19 / Raksha $29** — gate how many parents, daily touches, nicknames, and features are available. See `pricing.py`.

## Feature set (backend-verified)

| Area | What it does | File(s) |
|---|---|---|
| **Scheduled check-ins/reminders** | 1-min delivery loop, per-parent timezone, rotating message variants (3–7 per slot/language) | `scheduler.py`, `templates_data.py`, `whatsapp.py` |
| **Send-time activity window** | Messages are deferred if sent outside the parent's typical active hours. Window is auto-learned from historical reply patterns OR manually set on the parent profile. Prevents nagging during temple visits, market trips, sleep hours. | `models.py` (new fields), `scheduler.py` (send-time check) |
| **Personalization** | Nicknames (rotate daily), habits (tea/walk/wake/sleep), memory-prompt stories, `other_parent_name` ("did Amma have lunch too?"), city-driven seasonal greeting, birthday | `models.py`, `templates_data.py` |
| **Distress detection** | Layer 1: keyword matching (always on, free, fail-safe). Layer 2: Sarvam AI chat-completions as an advisory classifier on **voice transcripts only** — off by default (`DISTRESS_ML_ENABLED=false`), every transcript still logged to `distress_logs` for future fine-tuning | `distress_detection.py` |
| **Monthly reports** | Touch/delivery/voice-reply stats; Bandham/Raksha get a mood-over-time graph + trend note; Raksha fans out to both kids. **Auto-triggered on the 1st of every month** via scheduler job. Pushes a "report_ready" WhatsApp template to the child (and Care Circle for Raksha) with a deep-link to the dashboard. | `monthly_report.py`, `scheduler.py` |
| **Emergency contacts** | Separate from Care Circle — up to 5 per parent, E.164-validated | `server.py` (`/parents/{id}/emergency-contacts`), `models.py` |
| **Two-way moments (A Moment)** | Child → parent warm note + **up to 2 photos**, delivered via WhatsApp. Client-side Canvas optimization (max 1200px, 80% quality JPEG). Images uploaded to `/moments/upload-image` endpoint, served statically. | `server.py` (`/moments`, `/moments/upload-image`), `models.py`, `components/CareTab.jsx` |
| **Say-hi preview** | Child can send a warm greeting to a parent before full daily activation — "your child has set up AYANA, you'll start getting check-ins tomorrow". Uses a localized plain-text send. | `server.py` (`POST /parents/{id}/say-hi`) |
| **Care Watch** escalation engine | Runs every 5 min: retries unanswered check-ins AND medicine reminders on a unified **30-min cadence for up to 2 hours** (4 sends total). Afternoon no-reply warning to child + Care Circle + emergency contacts (once/day). Birthday + fixed/lunar festival auto-wishes (once/day). | `escalation.py`, wired into `scheduler.py` |
| **Recovery mode (Raksha only)** | User-set extra reminder slots for a period; archived (not deleted) on expiry via a daily job, one-tap re-enable | `server.py` (`/schedules/{id}/recovery/start`, `/end`), `scheduler.py` |
| **Re-engagement** | Per-schedule configurable window (`reengagement_hours`), same mechanism for all plans — no tier gets priority delivery | `whatsapp.py`, `scheduler.py` |
| **Interactive button routing** | Structured button taps (Done/Skip on medicine, Yes/Not yet on meals) are routed through the dedicated `interactive_button_handler.py` engine with callback hooks for status updates. Falls back to generic intent resolution for template buttons. | `server.py` (webhook handler), `interactive_button_handler.py` |
| **Delivery fallback & retry** | If a WhatsApp template send fails after all retries (e.g. error 21008 template rejected, phone unreachable), automatically falls back to a plain-text send so the parent definitely gets the message. Recheck interval is configurable. | `whatsapp.py` (`_send_content_template_with_retry`) |
| **Parent language auto-detect** | On first inbound reply, the system detects whether the parent responded in Telugu or Hindi script vs. their configured language. If mismatched, a suggestion is stored on the parent record and surfaced in the Dashboard — the child can accept the change with one click. | `server.py` (`_detect_language`, `GET /parents/{id}/language-suggestion`, `PUT /parents/{id}/language`) |
| **Parent + Schedule unified editor** | Dashboard **Parents tab** now shows inline schedule status (active toggle, check-in times) per parent. Clicking "Edit" opens a single dialog that edits parent details (nicknames, habits, notes) **and** schedule together — mirrors the onboarding flow. | `pages/Dashboard.js`, `components/ScheduleEditor.jsx` |
| **A Moment tab (renamed Care)** | "Care" tab renamed to **"A Moment"**; supports text + up to 2 photos; immediate WhatsApp delivery on send. | `pages/Dashboard.js` (tab label), `components/CareTab.jsx` (MomentComposer) |
| **Reply privacy (eye icon)** | Parent replies in "Replies" tab are **hidden by default**. Click the 👁️ eye icon to reveal message content — protects parent privacy on shared screens. | `pages/Dashboard.js` (`revealedReplies` state) |
| **Report month selection** | Report dropdown **starts from the user's signup month** (`user.created_at`) — no earlier empty months shown. | `pages/Dashboard.js` (`monthOptions` useMemo) |
| **Streamlined Activity History** | Account → Activity tab filters audit logs to **only signup and plan changes** (upgrades/downgrades). Login/logout noise removed. | `pages/Dashboard.js` (`relevantLogs` filter) |
| **Auto-logout (5 min inactivity + refresh)** | Session expires after 5 minutes of no mouse/keyboard/touch/scroll activity, **and** on page refresh (detected via Performance Navigation API). | `contexts/AuthContext.js` |

## File map

```
backend/
  server.py            — all API routes (auth, parents, schedules, moments, circle, webhook, admin)
  models.py             — Pydantic request/response models (includes activity_window fields, MomentInput.image_urls)
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
  components/CareTab.jsx   — emergency contacts + moments (up to 2 images) + recovery mode UI
  components/ScheduleEditor.jsx — reusable schedule builder with category icons
  lib/fallbackPlans.js    — client-side mirror of pricing tiers for zero-latency render
  contexts/AuthContext.js — auth state, token refresh, **5-min inactivity auto-logout**, page-refresh logout
```

## Dashboard UX — what changed (this pass)

| Tab | Before | After |
|-----|--------|-------|
| **Parents** | Separate "Parents" and "Schedules" tabs; edit parent in one dialog, schedule in another | Single "Parents" tab. Each parent card shows inline schedule (active toggle + check-in times). One "Edit" dialog handles **parent details + schedule together** (nicknames, habits, notes, medicines, check-ins). |
| **A Moment** (was Care) | Text + single photo URL input | **Text + file upload (up to 2 images)**, client-side Canvas optimizer, drag-drop previews. Sends immediately. |
| **Replies** | All reply content visible | Content **hidden by default**. 👁️ eye icon per row reveals message. |
| **Reports** | Fixed 6-month lookback | Months start from **signup month** (`user.created_at`), up to 12 months back. |
| **Account → Activity** | Full audit log (login, logout, every action) | **Only signup + plan changes** (upgrade/downgrade). |
| **Auth** | Persistent session | **5-min inactivity → auto-logout**. **Page refresh → auto-logout**. |

## Security hardening (this pass — all 15 identified vulnerabilities addressed)

| Vulnerability | Fix | File(s) |
|---|---|---|
| JWT revocation missing on logout | Token blacklist (`jwt_blacklist` collection) with JTI + TTL index; `revoke_token()` called on logout | `auth.py`, `database.py`, `server.py` |
| OTP brute-force (no global rate limit) | Redis-backed verify rate limit: 10 attempts / 15 min per phone | `otp.py`, `rate_limit.py` |
| OTP race condition (concurrent verify) | Atomic `find_one_and_update` with `$inc` for attempts counter | `otp.py` |
| Public image uploads (no auth) | Signed URLs (HMAC-SHA256) with 5-min expiry; `StaticFiles` mount removed | `server.py` |
| Image metadata/EXIF leakage | Server-side Pillow re-encoding strips metadata, validates MIME + content | `server.py` |
| JWT in localStorage (XSS risk) | HttpOnly, Secure, SameSite=Strict cookies for access/refresh tokens; `withCredentials: true` on axios; localStorage no longer stores tokens | `auth.py` (`set_auth_cookies`), `server.py` (login/register/refresh), `frontend/src/lib/api.js`, `frontend/src/context/AuthContext.js` |
| In-memory rate limiting | Distributed Redis-backed sliding-window rate limits: OTP 5/15 min, login 10/15 min + 15-min lockout, API 100/min per IP; graceful degrade if Redis down | `rate_limit.py`, `server.py` |

## What's NOT done / verified — read before you assume it works

1. **Nothing has been tested against real WhatsApp.** `WHATSAPP_ENABLED=false` and all `META_WA_*` credentials in `.env` are blank. Every "PASSED" in `test_result.md`, including all of Care Watch/moments/emergency contacts, was verified in simulated-send mode only.
2. **Meta template approval** — the 6 templates (`ayana_opener`, `ayana_medicine`, `ayana_meal`, `ayana_mood`, `ayana_reengager`, `ayana_report_ready`) are referenced by name in `_CATEGORY_TEMPLATE_NAME`. They must be submitted & approved in the Meta Business Manager before any out-of-session message will send. The `send_test` API and Onboarding UI work in simulation mode regardless.
3. **CareTab.jsx (emergency contacts, moments, recovery mode) has never been click-tested.** The testing agent hit the backend routes directly with HTTP requests, not through the UI.
4. **Dashboard "Edit parent" dialog** — inline schedule + parent edit is new; habits/nicknames/stories editing inside the dialog is implemented but could need polish.
5. **Blank-birthday 422 bug** — fixed with a `mode="before"` validator in `models.py` that maps `""` → `None`; regression test added in `backend/tests/test_ayana_api.py`.
6. **`backend/tests/test_ayana_api.py` is stale relative to the current models** — e.g. it POSTs `relationship: "Mother"` / `"Grandmother"`, but `ParentInput.relationship` only accepts lowercase `mother|father`. Those tests would fail if run; needs a full re-sync pass.
7. **Distress ML (Layer 2) has a real Sarvam integration** — off by default (`DISTRESS_ML_ENABLED=false`) and never exercised end-to-end with a live key.
8. **Monthly report WhatsApp push** — now **enabled by default** (`AUTO_MONTHLY_REPORTS=true`) and pushes `ayana_report_ready` to the child on the 1st of each month. The report deep-link points to `{FRONTEND_URL}/reports/{parent_id}/{period}` — confirm that route exists in the frontend Dashboard.
9. **Moment image upload endpoint** — `/moments/upload-image` saves files to `backend/static/uploads/` and serves them via signed URLs. In production, this should be replaced with S3/Cloudinary/Object Storage.
10. **CSRF protection** — `validate_csrf_token` in `auth.py` now **skips validation for Bearer (JWT) authenticated requests** (which the frontend uses). CSRF cookie is not set; if cookie-based auth is added later, re-enable CSRF properly.
11. **Rate limiting** — now backed by **Redis** (`rate_limit.py`) instead of in-memory `slowapi`. Limits: OTP 5 sends/15 min, login 10 attempts/15 min (with 15-min lockout), API 100 requests/min per IP. Set `REDIS_URL` env var. Falls back gracefully if Redis is unreachable (rate limiting disabled, logs a warning).

## Environment variables

See `backend/.env.example` — includes all 6 Meta template names and the distress-ML vars.

### New / changed env vars (this pass)

| Variable | Default | Purpose |
|---|---|---|
| `WHATSAPP_ENABLED` | `false` | Master toggle for all Meta WA sends |
| `AUTO_MONTHLY_REPORTS` | `true` (was `false`) | Enables the daily scheduler job that fires on the 1st of the month |
| `WA_DELIVERY_RECHECK_MIN` | `5` | Minutes to wait before falling back to plain-text on a failed send |
| `WA_DELIVERY_FALLBACK` | `true` | Enable/disable the plain-text fallback after template send failure |
| `BASE_URL` | (empty) | **Required for moment images** — public URL prefix (e.g. `https://api.ayana.care`) so uploaded images get full URLs in WhatsApp payloads |
| `DISTRESS_ML_ENABLED` | `false` | Enables Sarvam AI classifier for voice transcripts |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection for distributed rate limiting — required for multi-replica deployments |

## Architecture notes

- **Frontend ↔ Backend**: Strictly API-only. The frontend imports only from `lib/api.js`. Auth tokens are stored in **HttpOnly, Secure, SameSite=Strict cookies** set by the backend on login/register/refresh. Axios uses `withCredentials: true` to send cookies automatically. No tokens in localStorage (XSS-safe). Bearer-header auth still works for non-browser clients.
- **Distributed scheduler lock**: APScheduler runs in-process in every API replica. Each job is wrapped in `_with_lock()` which uses a short-lived Mongo doc with a TTL index. Only one replica wins the lock per tick — prevents duplicate WhatsApp sends and double Meta billing. If a lock holder crashes, TTL expires the lock.
- **Image upload for moments**: Client uploads base64-encoded images to `/moments/upload-image`. Backend decodes, validates MIME/size via Pillow (re-encodes to strip EXIF/metadata), saves to `static/uploads/`, returns signed URL (HMAC-SHA256, 5-min TTL). **In production, replace static file serving with S3 presigned POST + CloudFront.**
- **JWT revocation**: Access & refresh tokens carry a `jti` claim. On logout, both tokens' JTIs are added to `jwt_blacklist` collection with TTL auto-expiration. `get_current_user` checks blacklist on every request.
- **Auto-logout**: Client-side only (no server session invalidation). On 5-min inactivity or page refresh, frontend calls `logout()` which posts `/auth/logout` (server revokes tokens + clears cookies) and sets `user=false`.
- **CSRF protection**: Disabled for Bearer-token endpoints. `validate_csrf_token` returns early if `Authorization: Bearer <token>` header is present. JWTs in headers are not vulnerable to CSRF by design. If cookie-based auth is ever added, re-enable CSRF and set the cookie in login/register responses.

## Quick start (dev)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in JWT_SECRET, MONGODB_URI, etc.
uvicorn server:app --reload --port 8000

# Frontend
cd frontend
npm install
npm start
# Opens http://localhost:3000 (proxies to http://localhost:8000/api)
```

Ensure `REACT_APP_BACKEND_URL=http://localhost:8000` in `frontend/.env` (default).