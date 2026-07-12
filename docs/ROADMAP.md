# Lev Yam Platform — Roadmap

The path from today's platform to the [vision](VISION.md). Ordered by **value and
dependency** (steady pace, no external deadline). Tick tasks as they complete; each work
session should start by reading this file and end by updating it.

**How we work:** one phase = one or more feature branches off `main`; verify locally
(`cd app-src && npm run dev`, static pages via `python3 -m http.server 8080`) before pushing —
there is no staging. DB changes go through `supabase/schema/*.sql` (re-run in the Supabase SQL
editor). `pos.html` and the marketing site stay untouched until their replacement earns
cut-over on real service days.

---

## Phase 0 — Platform foundation ✅ (done, live)

- [x] `/app` shell: Vite + React + TS, react-router (`basename /app`), CI deploy to Pages
- [x] Supabase auth + passkeys (`01_passkeys.sql`, `passkey-verify` edge function)
- [x] RBAC: role → module → action, RLS via `core.has_permission()` (`00_core.sql`)
- [x] Users admin module (roles: owner / manager / staff / viewer)
- [x] Finance module: entries + report (`20_finance.sql`)

## Phase 1 — First migrations: quotes manager, then POS (+ bilingual core)

*The quotes manager goes first: it's the smallest complete tool — the cheapest way to prove
the module pattern — and it's used by one person, so a migration hiccup costs nothing (the
POS is live on real service days). Its migration produces the documented module template
that POS and every later module follow. The i18n layer lands at the very start so nothing
bilingual is ever a retrofit.*

- [x] **Foundation:** platform i18n layer (HE + Levantine Arabic, RTL-aware) in the app
      shell — dictionaries, language switcher, translated shell/login/launcher; every module
      from here on ships in both languages *(live 2026-07-08; follow-ups: bilingual module
      labels in `core.modules`, Arabic webfont — system-font fallback for now)*
- [x] **Quotes manager joins the platform** — migrate the local quotes & contracts app
      (`~/lev-yam-quotes`: Python API + React dashboard + `quotes-tracker.json` as source of
      truth) into a quotes module at `/app/quotes`.
      **Never copy that app into this repo** — it holds customer PII, signed contracts, and
      the owner's signature, and everything here deploys publicly to GitHub Pages; it stays a
      separate local app until this migration. **Full migration plan:
      [plans/quotes-module.md](plans/quotes-module.md)** — schema `30_quotes.sql`, dashboard
      → module UI, documents rendered from DB, one-time data import, parity cut-over
      *(done 2026-07-09: module live at `/app/quotes`; data imported — 12 quotes,
      3 contracts with full document content parsed from the saved HTML files, checklist
      template, signed-contract PDF/HTML snapshots in the private `quotes-docs` bucket;
      `~/lev-yam-quotes` archived to a private GitHub repo, read-only from now on)*
- [x] **Foundation:** extract a documented module template from the quotes migration
      ("how to add a module": schema + RLS, `core.modules` row, permissions, folder, route,
      launcher tile) — this is what makes the flexibility dream cheap later
      *(written 2026-07-09: [MODULE-TEMPLATE.md](MODULE-TEMPLATE.md) — the checklist the
      POS migration follows; update it whenever a migration teaches something new)*
- [x] **Foundation: cross-module spines (events, money, preparation)** — design + owner
      decisions (gross amounts, POS day-summaries, deposit due signing+N days, tentative
      quotes on calendar): [plans/cross-module-foundation.md](plans/cross-module-foundation.md).
      Landed **before** the POS port so POS integrates on day one:
  - [x] `21_finance_spine.sql`: provenance (`source_module`/`source_ref`/`event_id`) +
        derived-row immutability on `finance.entries`; `finance.expected` (deposits,
        balances due); `finance.record_payment()`; `finance.event_pnl()`
        *(applied to prod 2026-07-09)*
  - [x] `40_events.sql`: `events` schema — canonical events + tasks, calendar/feed/
        conflicts views, RLS + permission seeds (module row seeded **disabled** until the
        Phase 2 UI); quotes → events projection trigger, backfill, expectations-on-sign,
        income-on-paid *(applied + backfilled 2026-07-09: 2 confirmed + 1 tentative event
        projected; full sent→signed→paid lifecycle verified on prod, 13/13 assertions)*
  - [x] Finance UI pass: provenance badges, derived-only categories (`events`, `pos`,
        `pos_food`, `pos_labor`) blocked for manual entry, "expected" tab *(done
        2026-07-10; one-writer-per-category is now also DB-enforced in `entries_guard`;
        verified end-to-end in the preview harness at phone width)*
  - [ ] Finance follow-ups (discovered in the UI-pass review, 2026-07-09): **partial
        payments** on `finance.expected` (`record_payment` closes the expectation at any
        amount — needs remainder/split support; UI warns for now); a **reversal path** for
        posted entries with no owning module (payments on hand-created expectations get
        `source='finance'` and are immutable with no corrector); **HE/AR retrofit** of the
        finance module chrome (predates the i18n layer); EntriesTab form → child component
        (keystrokes re-render the entries table)
- [x] POS: map `pos.html` features → module design under `app-src/src/modules/pos/`
      (against the spines: `pos.close_day()` posts to finance; bills carry optional `event_id`)
      — **full migration plan: [plans/pos-module.md](plans/pos-module.md)** (kickoff
      2026-07-09: finance UI pass first; scope = parity-ready + deployed alongside
      `pos.html`; reuses the live `public.pos_*` tables)
- [x] Port billing: bills, items, combos, tips/discounts, payments, reopen/voids
      *(done 2026-07-10, PR #4 — `42_pos_platform.sql` applied to prod, `pos` schema
      exposed; anon pos.html path probe-verified unchanged)*
- [x] Port kitchen pipeline (chef mode: qty → sent → done → served)
- [x] Port day report (chef ops view / manager P&L) + expenses + date presets
      (+ new: close-day button posting the business day into finance)
- [x] Wire `pos.*` permissions per role (order/kitchen/analytics/costs/reports/manage;
      legacy create_bill/refund retired)
- [ ] Parity trial: run `/app/pos` alongside `pos.html` on real service days
- [ ] Cut over: `pos.html` redirects to `/app/pos` (+ drop anon policies, harden
      `created_by` from JWT, consider `pos` schema move + menu-as-data +
      server-side bill recompute + `pos.range_report` — see plan §8a)

## Phase 1.5 — Platform hardening (2026-07-10 audit)

*Follow-ups from the full-project best-practices audit — details, sizing, and owner
questions: [plans/platform-hardening.md](plans/platform-hardening.md). The audit's #1
item — the anon `pos_*` surface — is the POS cut-over task above, not repeated here.*

- [ ] **H1** RLS regression suite (`supabase/tests/rls_matrix.sql`: per-role can/can't
      matrix) + `PERM` ↔ `core.permissions` drift check as a `ci.yml` step
- [ ] **H2** Schema migration pipeline (Supabase CLI, versioned migrations + drift
      check in the gate) — owner decision Q2
- [ ] **H3** Permission governance: last-admin lockout guard + `core.audit_log` on
      role/permission changes *(ships with H6 — one guards branch)*
- [ ] **H4** RLS initplan sweep: wrap `core.has_permission()` / `auth.uid()` in policies
      as `(select …)`; add the pattern to MODULE-TEMPLATE.md — gates Phase 2's
      public feed
- [ ] **H5** Invite flow (`admin-invite` edge function + users-module action) +
      self-service password reset on the login screen — gates Phase 3's member role;
      timing = owner decision Q3
- [ ] **H6** `finance.expected` module-row guard (status-only client transitions on
      module-sourced expectations)
- [ ] **H7** Hygiene batch — nine small repo/UX/ops items (storage policies into
      `supabase/schema/`, users-module HE/AR, error boundary, dependabot, …; PITR
      deferred — trigger rule in the plan); full list in the plan
- [x] **Mobile-UX foundation pass** (owner-directed 2026-07-11, not from the audit):
      progressive-disclosure rows (summary → tap → full detail + actions) shell-wide,
      ≥44px touch targets, ≥16px inputs (iOS zoom), launcher tile descriptions, users
      tab → role-chip cards, class-keyed mobile CSS (unblocks the HE/AR retrofits).
      POS deliberately untouched (parity trial). Plan:
      [plans/platform-mobile-ux.md](plans/platform-mobile-ux.md)
      *(done 2026-07-12: PR #5 merged + deployed, smoke-checked; new bundle
      probe-verified on prod — rowline CSS + bilingual strings served; close-out +
      alignment verdict in the plan)*

## Phase 2 — What's happening: bookings & events

*Replaces WhatsApp-thread reservation tracking. The shared calendar itself is the `events`
spine landed in Phase 1 ([plans/cross-module-foundation.md](plans/cross-module-foundation.md))
— this phase builds the bookings module **on** it and takes it public, because the feed is
public by default.*

- [ ] `41_bookings.sql`: reservations table (RLS, permission keys) feeding the `events`
      spine; spine events already carry the **visibility flag — `public` by default,
      `internal` opt-out** (anon RLS reads published events only)
- [ ] Bookings module: day/week calendar, reservation CRUD (party size, contact, notes, status)
- [ ] Events management: community events, workshops, hosted dinners (title, time, capacity,
      owner) — designed so Phase 3 initiatives create these same events
- [ ] Confirmed quote events surface in the same calendar — the projection trigger +
      backfill land with the Phase 1 spine; here: verify in the calendar UI and migrate
      quotes prep checklists (jsonb) into `events.tasks`, then retire the column
- [ ] "Happening" feed v1 on the launcher: today's reservations + upcoming events —
      the first taste of *see what's happening*
- [ ] **Public "What's happening" on levyam.com** (HE/AR): the village and visitors see
      published events on the marketing site, read straight from Supabase
      *(prereq: the H4 initplan sweep — Phase 1.5)*

## Phase 3 — Community creation (the heart of the dream)

*Members propose ideas and bring them to life inside the app. An initiative is a generic
container for **any** dream (fishing trip, workshop, festival, tour…) — no hardcoded
categories.*

- [ ] New role: **member** (community), created **by team invitation only** for now
      (staff invite people they know; opening a public request → approve flow is Phase 6).
      *Prerequisite: the H5 invite + password-reset flows (timing = plan Q3) — members
      must onboard without anyone opening the Supabase dashboard*
- [ ] `50_initiatives.sql` + Initiatives module: **propose → approve → run** (any member
      proposes; the Lev Yam team approves before it goes live)
- [ ] Initiative workspace: description, team, tasks/next-steps, its own events
      (flowing into the Phase 2 calendar and, when public, the levyam.com feed)
- [ ] Initiative **budget & expenses tied to finance from day one** — with **per-initiative
      access control**: only that initiative's lead(s) + finance-permission holders see its
      money. This needs row-level, per-initiative grants (finer than role → module → action) —
      design the RLS model carefully before any UI
- [ ] Activity feed v2: venue life + initiative updates in one stream; public items flow to
      levyam.com, internal ones stay behind login
- [ ] Onboard the first real community members and run 1–2 real initiatives through it

## Phase 4 — Open the doors: transactions from outside

*The public already sees what's happening (Phase 2); now they can act on it. Everything here
is bilingual HE/AR like the marketing site.*

- [ ] Online booking on levyam.com → bookings module (anon insert with verification via an
      edge function; WhatsApp stays as a parallel channel)
- [ ] Event signup/tickets on the public "What's happening" feed (capacity, confirmation)
- [ ] Digital menu (QR at the table) — read-only first, sourced from POS items
- [ ] Table ordering → POS kitchen pipeline (only after the QR menu is proven)
- [ ] Notifications channel (WhatsApp/email confirmations) — needed once booking goes public

## Phase 5 — Deep operations

- [ ] Staff & shifts module: scheduling on top of users/roles, hours overview
- [ ] Inventory & suppliers: stock, purchasing → finance expenses, linked to POS menu items
- [ ] Dashboards v2: consolidated P&L (POS + quotes + finance), trends over time,
      per-initiative views

## Phase 6 — Community & loyalty

- [ ] Returning-guest recognition (from bookings + POS history)
- [ ] **Open the membership door:** public request → approve flow on levyam.com — membership
      grows beyond team invitations (revisits the Phase 3 invite-only decision)
- [ ] Social-impact storytelling: real numbers from the platform feeding the marketing site

---

## Cross-cutting foundations (touched in every phase)

- **Module template** (created in Phase 1, improved after): keep "new module" a ~1-hour task
- **Bilingual everywhere:** HE + Levantine Arabic from Phase 1, internal and public alike —
  the i18n layer lands with the first module and nothing is retrofitted
- **Public by default:** feed/calendar content is visible on levyam.com unless marked
  internal — every content table carries a visibility flag from its first migration
- **Mobile-first:** staff and members work from phones — test there first
- **RLS is the guard — and it's tested, not just written** (from Phase 1.5): every new
  table gets policies before UI; the regression suite runs after every schema apply and
  a new module adds its can/can't assertions with its policies; `lib/permissions.ts`
  mirrors the seeded keys. Money data is the strictest: initiative finance uses
  per-initiative grants, never platform-wide visibility
- **This file is the tracker:** update checkboxes and add discovered tasks each session
