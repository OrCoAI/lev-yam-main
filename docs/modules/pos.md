# POS — module log

Platform module live at `/app/pos` — the sole production POS since cut-over
(2026-07-15); `pos.html` now redirects there. Schema: `supabase/schema/10_pos.sql`,
`42_pos_platform.sql`, `43_pos_cutover.sql` (tables live in the `pos` schema).
UI: `app-src/src/modules/pos/`. Background: [plans/pos-module.md](../plans/pos-module.md),
[plans/pos-cutover-hardening.md](../plans/pos-cutover-hardening.md).

See [README.md](README.md) for how this file works — bugs/small features only; anything
touching schema, permissions, or the events/finance spine graduates to a `docs/plans/` plan.

## Open bugs

- (none logged)

## In progress — POS menu-as-data + kitchen reliability (kickoff 2026-07-28)

Owner-directed batch that **completes and expands PR D** of POS ops v2. Plan + locked
decisions: [../plans/pos-menu-kitchen.md](../plans/pos-menu-kitchen.md). Six workstreams:
retire open house (forward-only, history kept); editable menu (menu-as-data, meals
first-class with components); kitchen dish filters (incl. meal components); realtime
reliability (kitchen was getting stuck); per-unit kitchen "done" (one tap = one item);
floor grid equal-height/responsive cards. Seed = the August 2026 printed menu.

- ~~**PR 1** — kitchen realtime reliability + per-unit "done" + floor grid~~ **done
  2026-07-28** (branch `pos-menu-kitchen`; `49_pos_kitchen.sql`; full gate green,
  owner-tested). Close-out in the plan.
- **PR 2** — menu-as-data + open-house retire + add-ons + first-class meals + kitchen
  filters. *Gated on the owner's finalized August menu (olives add-on price, drinks list).*

### POS operations v2 (kickoff 2026-07-20) — status

Six capabilities → five PRs. Umbrella: [../plans/pos-operations-v2.md](../plans/pos-operations-v2.md).

- ~~**PR A** — Kitchen in/out visibility~~ **done 2026-07-21 (#26, live).**
- ~~**PR B** — Summary redesign + expenses upgrade~~ **done 2026-07-21 (#27, live).**
- ~~**PR C** — Split/partial payments + checkout item-delete~~ **done 2026-07-22 (#28, live).**
- **PR D** — Menu-as-data → **expanded into the initiative above** (kickoff 2026-07-28).
- ~~**PR E** — Day lifecycle: open → booked, drift-flag, re-post/override~~ **done 2026-07-22 (#29, live).**

## Open feature ideas

- **Unify day revenue behind one boundary** (altitude follow-up from the 2026-07-22
  hotfix): `pos.post_day` now reads revenue from two sources inline (new-era
  `pos_payments` + legacy payment-less `pos_bills`). Fold both behind a single
  `pos.day_revenue(p_date) → (cash, card)` view/function so `post_day` stays
  source-agnostic and the legacy grammar is encapsulated. Zero-migration, no
  live-money risk — deliberately deferred (not weekend work). Do **not** "solve" this
  by backfilling `pos_payments` for historical bills: it re-encodes the same tip
  split as an irreversible write to live money rows.
- Full menu-as-data (owner-editable menu table + admin UI) — deferred beyond the
  cut-over initiative; only a server-side price-validation mirror (`pos.menu_price`)
  shipped there. **→ now PR D above.**
- A CI check diffing `app-src/src/modules/pos/menu.ts` prices against the SQL literals
  in `pos.menu_price()` — the mirror has no automated sync guard yet; a price edited in
  only one place fails closed (blocks table closes) rather than silently
  under-charging, which is safe but is an availability bug waiting to happen.
  **→ obsoleted by PR D** (single source of truth in the DB retires the mirror).

## Done

- 2026-07-22: **legacy-day revenue-wipe hotfix** (part of PR C/E, #29). PR C rewrote
  `pos.post_day` to derive cash/card revenue only from the new `pos_payments` table;
  every bill closed before split-payments shipped has its money only on `pos_bills`
  (zero payment rows), so re-posting a legacy day recomputed revenue as ~0 and PR E's
  auto-repost wiped it from the finance books on the next expense edit. Reported by Or
  ("added expense on a closed date, not able to add to the books"). Fixed: `post_day`
  now sums revenue from **both** sources — payments (new bills) plus the pre-PR-C
  bill grammar (`card = least(card_paid, grand_total)`, `cash = grand_total − that`)
  for payment-less bills — so re-posting an untouched legacy day is a true no-op.
  Corrected function applied to prod immediately (live money path); no data was
  corrupted (caught before any correction committed). Also hardened `rls_matrix.sql`
  to set a resolvable `auth.uid()` during its as-postgres phases (the auto-repost
  correction's `created_by` needs a non-null actor) + added legacy-day preservation
  assertions. **code-review follow-on:** because `post_day` now reads revenue off
  payment-less bills, `pos_bills` mutations on a booked day must re-post too — added
  `pos_bills` auto-repost triggers (INSERT/DELETE always; UPDATE only on revenue
  columns, so the archived_at "clear day" sweep doesn't storm) and extended
  `pos_close_table`'s end-of-close re-post loop to cover the bill's own `paid_at`
  day (a fallback close records no payments). Closes a reopen/fallback-close
  double-count/stale-revenue drift.
- 2026-07-15: **cut-over & hardening** shipped — `pos.html` → redirect to `/app/pos`,
  anon RLS/grants dropped, `created_by`/`closed_by` from JWT, tables moved into the
  `pos` schema, server-side bill validation (item prices + open-house charge +
  extras_total cross-check — the last one added during `/security-review` after the
  first cut was found incomplete), `pos.range_report`. Full close-out:
  [plans/pos-cutover-hardening.md](../plans/pos-cutover-hardening.md).
- 2026-07-14: parity trial confirmed clean (full shifts matched `pos_day_report` to the
  shekel); backfilled missing finance postings for 2026-07-03/07-04 via `pos.close_day`
  (operational fix, unrelated to POS code).
