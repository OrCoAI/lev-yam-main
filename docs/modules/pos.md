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

## Open feature ideas

- Full menu-as-data (owner-editable menu table + admin UI) — deferred beyond the
  cut-over initiative; only a server-side price-validation mirror (`pos.menu_price`)
  shipped there.
- A CI check diffing `app-src/src/modules/pos/menu.ts` prices against the SQL literals
  in `pos.menu_price()` — the mirror has no automated sync guard yet; a price edited in
  only one place fails closed (blocks table closes) rather than silently
  under-charging, which is safe but is an availability bug waiting to happen.

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
