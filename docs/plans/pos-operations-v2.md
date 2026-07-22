# POS operations v2 — program plan

Post-cut-over operational hardening of the live POS module (`/app/pos`). A batch of
six owner-requested capabilities, sequenced into **five PRs**. This is the umbrella;
each PR gets its own detailed plan file (schema / RLS / permissions / UI) at its
kickoff. Owner alignment on scope was completed 2026-07-20 (decisions locked below).

Module: `app-src/src/modules/pos/`. Schema: `supabase/schema/10_pos.sql`,
`42_pos_platform.sql`, `43_pos_cutover.sql`, `45_pos_seeds.sql`. Module log:
[../modules/pos.md](../modules/pos.md).

## The six requests → five PRs

| PR | Items | Surface | Size |
|---|---|---|---|
| **A — Kitchen visibility** | #2 | Floor + table view: at-a-glance cooking / ready / served per table & item | S |
| **B — Summary + expenses** | #4 + #6 | `ReportView`: week/month presets, one-click custom, accordion redesign; expenses show who/when + receipt flag + paid date; full expenses over the selected period | M |
| **C — Split/partial payments** | #1 | New `pos.pos_payments`; bill can be partially paid **while open** (deposit now, rest later); delete items at checkout with a void trail | M–L |
| **D — Menu-as-data** | #3 | Owner-editable menu (categories + items + prices + open-house flag); retires the `pos.menu_price()` literal mirror. Combos stay code for a later pass | L |
| **E — Day lifecycle** | #5 | `ReportView` + finance: explicit day state (open → booked), drift detection, explicit re-post/override | L |

Build order: **A → B → C → D → E**. Rationale: A is independent low-risk UI (warm-up);
B and E share the `ReportView` surface and #6's "expenses over the period" is part of #4;
E ("write to the books") must reconcile the final payment split (C) and expense state (B),
so it lands last.

## Locked decisions (owner, 2026-07-20)

- **#5 day lifecycle = auto re-post + notify.** *(Revised 2026-07-21, superseding the
  original "flag + explicit re-post" middle ground — owner: "if I am changing a bill from a
  day that already been added to the books the update should take in place".)* When a booked
  day's money changes, the posting re-runs **automatically** and writes the correcting delta,
  and the correction is **recorded and surfaced** so nothing moves in the books silently.
  Still no hard lock. Builds on the existing idempotent delta posting in `pos.close_day`
  (`43_pos_cutover.sql`); the permission check moves to a thin manual wrapper so the
  automatic path can post without requiring the editing staff member to hold `pos.manage`.
- **#1 payments = partial-while-open.** A table can take payments over time while still
  open (deposit / one guest pays and leaves), closing only when fully paid → needs an
  open-bill **balance-due** concept, not just a checkout-time split.
- **#1 checkout item-delete = allowed with a void trail** (who/why) even for already-fired
  items, since the kitchen cost is already incurred.
- **#3 menu = flat items first.** Categories + items + prices + open-house flag become
  owner-editable data (covers "update menu items easily" + retires the price mirror).
  Combos (slots/options) stay code, modelled as data in a later pass.
- **#6 paid-date = operational only.** Finance posting stays on the expense's
  `business_date` (accrual — matches that day's revenue). Paid-date is a cash-flow
  tracking field that does **not** move the finance posting.

## Alignment verdict (program level)

- **Roadmap:** not a numbered phase — post-cut-over operational hardening of the Phase 1
  POS. Feeds Phase 4 (QR digital menu "sourced from POS items" → design #3 with that
  reader in mind) and Phase 5 (inventory linked to POS menu items; staff/shifts ↔ labor
  expenses). Tracked as a "POS operations v2" line in [../ROADMAP.md](../ROADMAP.md).
- **Architecture:** every new capability is DB-first — new permission keys for payments,
  menu editing, day-booking, and the new expense fields; RLS via `core.has_permission`;
  schema in `supabase/schema/`; money stays on the finance spine (no POS-local silo);
  bilingual HE/AR via the shell i18n layer; mobile-first (staff work the floor on phones).
- **Vision:** strengthens the live venue-operations backbone; no drift.
- **Overlaps named (not conflicts):** the finance follow-up "partial payments on
  `finance.expected`" ([../ROADMAP.md](../ROADMAP.md)) is a *different* surface from POS
  bill-level split payments — kept distinct. #3 is designed knowing Phase 4's QR menu
  will read the same menu tables.

## Per-PR detail

Each PR's full schema / RLS / permission / UI design + open questions land in its own
plan file at kickoff, linked here as it starts:

- **PR A — Kitchen visibility** — UI-only (no schema). Make cooking / ready / served
  legible at a glance on the floor grid and in the table view, not just a single
  priority badge. *(in progress)*
- **PR B — Summary + expenses** — `plans/pos-summary-expenses.md` (TBD): `pos_expenses`
  gains `has_receipt`, `paid_at`; report UI redesign with accordions + week/month presets
  + full-period expense list surfacing existing `created_by`/`created_at`.
- **PR C — Split/partial payments** — `plans/pos-split-payments.md` (TBD): `pos.pos_payments`
  child table; open-bill balance-due; checkout item-delete void trail; `close_day`
  cash/card derivation moves onto recorded payments.
- **PR D — Menu-as-data** — `plans/pos-menu-as-data.md` (TBD): menu tables + RLS +
  `pos.menu` permission; admin UI; retires the `pos.menu_price()` literal mirror.
- **PR E — Day lifecycle** — `plans/pos-day-lifecycle.md` (TBD): day-state table, drift
  detection against booked finance entries, explicit re-post/override UI.

## Gate & close-out

Every PR runs the full pre-commit gate (`/simplify` → `/code-review high` →
`/security-review` → `/verify` incl. `rls_matrix.sql` for any `supabase/` diff) and its
own close-out. This umbrella file is updated as each PR lands.
