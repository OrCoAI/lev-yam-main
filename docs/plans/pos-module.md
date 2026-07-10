# POS Module — migrating pos.html into the platform

**Status: kickoff approved 2026-07-09 (scope decisions locked with the owner below).
Follows [MODULE-TEMPLATE.md](../MODULE-TEMPLATE.md); built on the spines from
[cross-module-foundation.md](cross-module-foundation.md).**

## 1. Scope — decisions locked with the owner (2026-07-09)

1. **Sequencing:** the *Finance UI pass* (provenance badges, derived-only categories,
   expected tab) lands **first** — it is the UI that makes POS→finance postings visible
   and verifiable during this port.
2. **"E2E" = parity-ready + deployed.** Everything ports — billing (bills, items, combos,
   tips/discounts, payments), kitchen pipeline, day report + expenses, permissions — and
   ships live at `/app/pos` **alongside** `pos.html`. The **parity trial on real service
   days and the cut-over are separate roadmap items**, deliberately not part of this
   initiative (roadmap rule: cut-over is earned on real service days).
3. **Data: reuse the live `pos` tables.** The module reads/writes the same
   `public.pos_*` tables `pos.html` uses (plus additive columns). Both UIs see the same
   live data, so the parity trial is honest and there is no import step.

## 2. What exists today (source inventory)

- **`pos.html`** (1,882 lines) — already React (CDN, function components + hooks) and
  **already bilingual HE/AR** (`tr(he,ar)`, `Bi`, `LangToggle`). Components:
  `App`, `HomeView`, `TableView`, `BillSummary`, `ComboPicker`, `PaymentModal`,
  `ChefView`, `ReportView`, `Stepper`, `RoleModal`, `AppGate` (PIN), plus the
  `usePosData` realtime sync hook. This is a **restructuring port, not a rewrite** —
  logic moves nearly verbatim into TSX module files.
- **`supabase/schema/10_pos.sql`** — live schema: `pos_tables` (open tables, realtime),
  `pos_bills`, `pos_bill_items`, `pos_expenses`; RPCs `pos_close_table`,
  `pos_reopen_bill`, `pos_mark_item` (chef marks done), `pos_day_report`; analytics
  views. Access today: **anon key + in-app PIN/role codes** (per-device roles).
- **Roles/permissions in pos.html** (`ROLE_PERMS`) — the keys already mirror platform
  RBAC 1:1: `pos.view`, `pos.order`, `pos.kitchen`, `pos.analytics`, `pos.costs_food`,
  `pos.costs_labor`, `pos.reports`, `pos.manage`.

## 3. The two spine questions (MODULE-TEMPLATE §0)

1. **What does POS project into `events`?** Nothing — POS **attaches** instead
   (cross-module-foundation §5): `pos_bills.event_id uuid` (nullable, additive) lets a
   private event's extras land in that event's P&L via `finance.event_pnl()`. A normal
   service day carries no event_id.
2. **What does POS post into `finance`?** **`pos.close_day(p_date)`** — the business-day
   posting rule (§3b, granularity locked 2026-07-09: day summary, gross, tips excluded):
   - income `pos` per payment method: `source_ref 'pos:<date>:cash'` / `'pos:<date>:card'`
     (method must be in the ref — the posting unique index is
     `(source_module, source_ref, kind, category)`, so two same-category rows need
     distinct refs)
   - expense `pos_food` / `pos_labor` from `pos_expenses`: `source_ref 'pos:<date>:food'`
     / `'pos:<date>:labor'`
   - **Tips never post** (pass-through to staff, not income). Discounts are already net
     in `grand_total`.
   - **Idempotent + correctable:** re-running `close_day` for an unchanged day is a
     no-op (unique index). If the day's numbers changed (late void), the function posts
     **reversal rows** (negative, `source_ref 'pos:<date>:cash:r2'`-style sequence) plus
     the corrected posting — never edits (derived rows are immutable by trigger).
   - Categories `pos`, `pos_food`, `pos_labor` are already seeded as **derived-only** in
     `21_finance_spine.sql`; the finance UI pass blocks them from manual entry.

## 4. Database plan — `supabase/schema/42_pos_platform.sql` (new file)

`10_pos.sql` stays the live tool's schema (pos.html keeps working untouched). The new
file layers the platform on top — idempotent, additive only:

- [ ] `create schema pos` — platform-side functions live here (`pos.close_day`);
  **tables stay in `public` until cut-over** (deliberate deviation from the template's
  one-schema rule: the live tool writes them; moving tables is a cut-over task).
- [ ] `alter table public.pos_bills add column if not exists event_id uuid references
  events.events(id)` (+ index where not null).
- [ ] `pos.close_day(p_date date)` — SECURITY DEFINER, `set search_path`, re-checks
  `core.has_permission('pos.manage')`, sets the `levyam.finance_posting` GUC, posts per
  §3 above. Returns the posting summary jsonb for the UI.
- [ ] **RLS: add `authenticated` policies** via `core.has_permission()` on all four
  `pos_*` tables (view → select; order → tables write; manage → bills/expenses write).
  **The existing anon policies stay** during parity — that is today's live posture
  (anon key + PIN), not a regression; **dropping them is a cut-over-day task**.
- [ ] Seeds: `core.modules` row (`pos`, sort after quotes), 8 `core.permissions` rows
  (keys above, Hebrew labels), `core.role_permissions`:
  | platform role | gets |
  |---|---|
  | owner, manager | all 8 |
  | staff | `view, order, kitchen, analytics, costs_food` (= today's chef; waiters and chefs are both "staff" — platform roles don't split them) |
  | viewer | `view` |
- [ ] Expose nothing new (tables are in `public`, already exposed); `pos` schema added
  to Exposed schemas for the RPC.

## 5. UI port map — `app-src/src/modules/pos/`

Per the template anatomy; every class prefixed `pos-`; mobile-first (the tool lives on
phones at the venue); HE/AR module i18n (port the existing `tr(he,ar)` pairs).

| pos.html | module file |
|---|---|
| constants, menu data, combos | `menu.ts` (verbatim data) |
| `usePosData` (realtime sync, offline queue) | `usePosData.ts` |
| supabase calls, `buildBillPayload`, RPCs | `api.ts` (with `assertWritten`) |
| `HomeView` (floor: open tables grid) | `PosModule.tsx` |
| `TableView` + `Stepper` + `BillSummary` + `ComboPicker` | `TableView.tsx` |
| `PaymentModal` (cash/card split, tip/discount) | `PaymentModal.tsx` |
| `ChefView` (kitchen pipeline qty→sent→done→served) | `ChefView.tsx` |
| `ReportView` (day report, expenses, presets) | `ReportTab.tsx` (+ **new: close-day button** posting to finance) |
| `RoleModal`, `AppGate`, PIN/role codes | **dropped** — platform login + RBAC replace them (`useCan(PERM.pos*)`) |
| `tr/Bi/LangToggle` | module `i18n.ts` on the shell's `useI18n` |

Route `/pos` behind `RequirePermission perm={PERM.posView}`; launcher `DESTINATIONS`
entry + brand icon.

## 6. Invariants (DB-enforced where possible)

1. Money math per bill: `grand_total = oh_charge + extras_total − discount`;
   `paid_total = grand_total + tip = cash_paid + card_paid` (generated columns hold the
   sums today; the close RPC remains the only writer of paid bills).
2. Kitchen ownership: waiter owns `qty/sent/served`, chef owns `done` via
   `pos_mark_item` only (never whole-row table sync from chef view).
3. One finance writer per category: `pos`/`pos_food`/`pos_labor` written only by
   `pos.close_day()`; manual entry blocked (finance UI pass + `entries_guard`).
4. `close_day` idempotent; corrections are reversals, never edits.
5. Both UIs share one source of truth during parity — **no schema change may break
   `pos.html`** (additive columns only, anon policies untouched).

## 7. Parity bar & cut-over (separate roadmap items — NOT this initiative)

- **Parity trial:** run `/app/pos` alongside `pos.html` on real service days; a full
  shift worked in `/app/pos` (open→order→kitchen→pay→report) with numbers matching
  `pos_day_report` to the shekel.
- **Cut-over day:** `pos.html` becomes a redirect to `/app/pos`; drop anon policies +
  grants from `10_pos.sql`; consider moving `pos_*` tables into the `pos` schema; retire
  in-file PIN/role codes.

## 8a. Follow-ups discovered in the build review (2026-07-10)

- **Money is still client-authored** — `pos_close_table` now enforces internal
  consistency (`grand = oh + extras − discount`, `cash+card = grand + tip`), but a
  consistent forgery is possible for any `pos.order` holder. Full fix = menu/pricing
  as DB data + server-side recompute — a **cut-over item** (menu-as-data is already
  the plan for owner-editable menus).
- **`created_by` on expenses is client-authored** — harden at cut-over with a
  trigger defaulting it from `auth.jwt()` (can't today: anon pos.html path has no JWT).
- **`pos.range_report(from,to)` RPC** — replace the client's per-day fan-out
  (up to 92 RPCs, all-or-nothing, 92-day cap) with one DB aggregate.
- **Parity-inherited quirks kept deliberately** (same behavior in live pos.html):
  device-local "today" for home totals/end-day vs Jerusalem-pinned reports;
  active-table resurrection if another device closes it mid-edit; range report
  fails whole if one day errors.

## 8. Open questions / risks

- **Waiter vs chef split:** platform "staff" role covers both (chef-level grants). If
  the owner wants waiter-restricted accounts later, that's a new platform role
  (cheap: one `core.roles` row + grants), not a schema change. Surfaced at kickoff.
- **Offline resilience:** pos.html tolerates flaky venue Wi-Fi (local state +
  re-sync). The port must keep `usePosData`'s local-first behavior; verify airplane-mode
  → reconnect during the parity trial.
- **Realtime:** `/app` Supabase client must subscribe to `pos_tables` changes the same
  way (publication already includes it).

## Close-out

*(to be written when the initiative finishes — what shipped, decisions, alignment
verdict vs VISION.md + ARCHITECTURE.md)*
