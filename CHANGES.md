# Frontend update — sync with new backend + design refresh

## Critical fixes (frontend was out of sync with the new backend)
- **Schedule creation was broken.** `ScheduleInput.mode` now requires
  `nitya|bandham|raksha`, but the frontend was still sending
  `"normal"` / `"care_plus"` (leftover from the old 2-tier plan
  model). Every place a schedule is created/updated
  (`Dashboard.js`, `Onboarding.js`) now sends the real plan id.
- Plan badges, Care Circle gating, and copy across `Dashboard.js` /
  `Onboarding.js` referenced the old `basic` / `care_plus` ids —
  replaced with the 3-tier `nitya` / `bandham` / `raksha` model,
  looked up by name from `/config` instead of hardcoded strings.

## New: habits + memory prompts (Onboarding + Dashboard)
- `habits` (wake/tea/walk/lunch/dinner/sleep times + tea-or-coffee)
  and `stories` (up to 5 rotating memory prompts) feed directly into
  `templates_data.py`'s tea/walk check-ins and mood/love-note
  messages, but had no UI. Added an editable habits grid + tea/coffee
  toggle and a memory-prompts list to both the Onboarding parent step
  and the Dashboard parent dialog, with the same restore-on-edit
  behavior as the other fields.

## New: distress-detection flags on the Replies tab
- `distress_detection.py`'s ML layer (`ml_flagged` on `parent_replies`)
  had no frontend surface. Voice replies the model flags — but that
  didn't match a keyword emergency — now get a soft amber "💛 Worth
  checking in" badge and border (distinct from the red keyword-
  emergency treatment, since it's a lower-confidence signal), plus a
  small dot indicator on the Replies tab when one is present.

## New: Reports tab (backend feature with no UI before)
- `monthly_report.py` + `GET/POST /reports/monthly*` existed with
  zero frontend. Added a full **Reports** tab: parent + month
  picker, touch/delivery/voice-reply stats, a mood-over-time line
  chart (recharts) with the trend note for Bandham/Raksha, an
  upgrade nudge for Nitya, and a "Generate report" action.

## New: parent personalization fields
- `nicknames`, `city`, and `other_parent_name` are used directly by
  `templates_data.py` to personalize messages ("did Nanna have
  lunch too?", seasonal greetings) but were missing from both the
  Onboarding parent step and the Dashboard "Add/Edit parent" dialog.
  Added to both, with a plan-aware nickname limit.

## New: Raksha recovery mode + re-engagement window
- `ScheduleEditor` now has a re-engagement-hours selector (maps to
  `schedule.reengagement_hours`) and a Raksha-only recovery-mode
  toggle with an end date (`recovery_mode` / `recovery_until`),
  wired through the schedule create/edit dialog.

## Design: multi-color headings
- Added `components/HighlightText.jsx` — colors words within a
  heading by position (works across en/te/hi without per-language
  word lists) — and `Hl` for JSX-composed headings. Applied across
  the Landing hero + all major section headings, and the Onboarding
  step headers, matching the reference "Effortless **Design** for
  Design Startups" style.
- `PricingCards` grid is now responsive to plan count (was hardcoded
  for 2 plans, backend now returns 3: Nitya/Bandham/Raksha).

## Not done / left for a follow-up pass
- Landing page language switcher is still a hardcoded 3-language
  list rather than reading `config.languages` — fine today since
  only en/te/hi exist, but will need updating once a 4th language
  is added via `translation_engine.py`.
