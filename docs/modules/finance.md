# Finance — module log

Live at `/app/finance`. Schema: `supabase/schema/20_finance.sql`,
`21_finance_spine.sql`, `54_finance_categories.sql` (categories-as-data).
UI: `app-src/src/modules/finance/`.
Background: [plans/finance-ux-pass.md](../plans/finance-ux-pass.md),
[plans/cross-module-foundation.md](../plans/cross-module-foundation.md).

See [README.md](README.md) for how this file works — bugs/small features only; anything
touching schema, permissions, or the events/finance spine graduates to a `docs/plans/` plan.

## Open bugs

- (none logged)

## Open feature ideas

> **In flight (2026-07-31):** categories-as-data, books reconciliation/alerts, owner
> override and cash↔bank transfers graduated to an initiative —
> [plans/finance-books-integrity.md](../plans/finance-books-integrity.md). The items below
> are *not* covered by it and stay open here.

- Partial payments on `finance.expected` — `record_payment` currently closes the
  expectation at any amount; needs remainder/split support (carried over from the
  2026-07-09 UI-pass review, see ROADMAP Phase 1 finance follow-ups)
- Reversal path for posted entries with no owning module (hand-created expectations get
  `source='finance'` and are immutable with no corrector today)
- Server-side provenance resolution — `source_ref` parsing currently lives client-side in
  `modules/finance/provenance.ts`; move into a DB view/generated column once a second
  surface (events module, dashboards) needs entry→quote/POS links
- When `finance.expected` grows real receivables tracking (the partial-payments item
  above), retire the quotes module's client-side-only `isWaitingPayment` derived status
  (`modules/quotes/types.ts`, added 2026-07-13) in favor of it — right now it's a UI-only
  stopgap (status + event_date, no due-date/deposit-vs-balance granularity) that will
  become a second, drifting source of truth once real receivables land

## Done

- (move closed items here with date + one-line note)
