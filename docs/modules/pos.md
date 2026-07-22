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

## In progress — POS operations v2 (kickoff 2026-07-20)

Six owner-requested capabilities → five PRs. Umbrella plan + locked decisions:
[../plans/pos-operations-v2.md](../plans/pos-operations-v2.md).

- ~~**PR A** — Kitchen in/out visibility~~ **done 2026-07-21 (#26, live).**
- ~~**PR B** — Summary redesign + expenses upgrade~~ **done 2026-07-21 (#27, live).**
- **PR C** — Split/partial payments (partial-while-open) + checkout item-delete. *(active)*
- **PR D** — Menu-as-data (flat items first; combos deferred) — folds in the two ideas below.
- **PR E** — Day lifecycle: open → booked, drift-flag, re-post/override.

## Open feature ideas

- Full menu-as-data (owner-editable menu table + admin UI) — deferred beyond the
  cut-over initiative; only a server-side price-validation mirror (`pos.menu_price`)
  shipped there. **→ now PR D above.**
- A CI check diffing `app-src/src/modules/pos/menu.ts` prices against the SQL literals
  in `pos.menu_price()` — the mirror has no automated sync guard yet; a price edited in
  only one place fails closed (blocks table closes) rather than silently
  under-charging, which is safe but is an availability bug waiting to happen.
  **→ obsoleted by PR D** (single source of truth in the DB retires the mirror).

## Done

- 2026-07-15: **cut-over & hardening** shipped — `pos.html` → redirect to `/app/pos`,
  anon RLS/grants dropped, `created_by`/`closed_by` from JWT, tables moved into the
  `pos` schema, server-side bill validation (item prices + open-house charge +
  extras_total cross-check — the last one added during `/security-review` after the
  first cut was found incomplete), `pos.range_report`. Full close-out:
  [plans/pos-cutover-hardening.md](../plans/pos-cutover-hardening.md).
- 2026-07-14: parity trial confirmed clean (full shifts matched `pos_day_report` to the
  shekel); backfilled missing finance postings for 2026-07-03/07-04 via `pos.close_day`
  (operational fix, unrelated to POS code).
