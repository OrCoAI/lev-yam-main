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
- [ ] POS: map `pos.html` features → module design under `app-src/src/modules/pos/`
- [ ] Port billing: bills, items, combos, tips/discounts, payments, refunds/voids
- [ ] Port kitchen pipeline (chef mode: qty → sent → done → served)
- [ ] Port day report (chef ops view / manager P&L) + expenses + date presets
- [ ] Wire `pos.*` permissions per role (order/kitchen/analytics/costs/reports/manage)
- [ ] Parity trial: run `/app/pos` alongside `pos.html` on real service days
- [ ] Cut over: `pos.html` redirects to `/app/pos`

## Phase 2 — What's happening: bookings & events

*Replaces WhatsApp-thread reservation tracking; creates the shared calendar everything else
plugs into — and takes it public immediately, because the feed is public by default.*

- [ ] `40_bookings.sql`: reservations + events tables, RLS, permission keys; events carry a
      **visibility flag — `public` by default, `internal` opt-out** (anon RLS reads published
      events only)
- [ ] Bookings module: day/week calendar, reservation CRUD (party size, contact, notes, status)
- [ ] Events management: community events, workshops, hosted dinners (title, time, capacity,
      owner) — designed so Phase 3 initiatives create these same events
- [ ] Confirmed quote events (quotes module) surface in the same calendar — the quotes app
      already tracks confirmed events + prep checklists; one calendar, not two
- [ ] "Happening" feed v1 on the launcher: today's reservations + upcoming events —
      the first taste of *see what's happening*
- [ ] **Public "What's happening" on levyam.com** (HE/AR): the village and visitors see
      published events on the marketing site, read straight from Supabase

## Phase 3 — Community creation (the heart of the dream)

*Members propose ideas and bring them to life inside the app. An initiative is a generic
container for **any** dream (fishing trip, workshop, festival, tour…) — no hardcoded
categories.*

- [ ] New role: **member** (community), created **by team invitation only** for now
      (staff invite people they know; opening a public request → approve flow is Phase 6)
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
- **RLS is the guard:** every new table gets policies before UI; `lib/permissions.ts` mirrors
  the seeded keys. Money data is the strictest: initiative finance uses per-initiative
  grants, never platform-wide visibility
- **This file is the tracker:** update checkboxes and add discovered tasks each session
