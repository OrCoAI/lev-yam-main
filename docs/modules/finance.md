# Finance — module log

Live at `/app/finance`. Schema: `supabase/schema/20_finance.sql`,
`21_finance_spine.sql`, `54_finance_categories.sql` (categories-as-data),
`55_finance_reconciliation.sql` (drift detection).
UI: `app-src/src/modules/finance/`.
Background: [plans/finance-ux-pass.md](../plans/finance-ux-pass.md),
[plans/cross-module-foundation.md](../plans/cross-module-foundation.md).

See [README.md](README.md) for how this file works — bugs/small features only; anything
touching schema, permissions, or the events/finance spine graduates to a `docs/plans/` plan.

## Open bugs

- (none logged)

## Open feature ideas

> **Completed 2026-08-03:** categories-as-data, books reconciliation/alerts, owner
> override and cash↔bank transfers shipped as an initiative —
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

- **2026-08-03 — books-integrity initiative COMPLETE (PRs A–D).** Categories as data,
  reconciliation + alerts, owner override, cash↔bank transfers. Close-out and alignment verdict
  in [plans/finance-books-integrity.md](../plans/finance-books-integrity.md) §10. Follow-up
  discovered: a cash-on-hand balance per payment method (transfers record the movement, nothing
  yet shows the resulting position).
- **2026-08-03 — transfers (initiative PR D).** `finance.transfers` as its own table, outside
  every income/expense total, with its own tab. A transfer creates no `finance.entries` row and
  does not move the P&L — both asserted in `rls_matrix`, so a future change that routes them
  through the ledger fails loudly.
- **2026-08-03 — owner override (initiative PR C).** `finance.post_correction()` lets the owner
  set any module-posted number to the right total by posting an additive correction; the
  original stays untouched (§7.4 holds). POS day **pins** ship alongside as a separate explicit
  freeze. Measured during the build and worth remembering: an additive correction already
  survives the auto re-post — `post_day()` totals a leg from its own `pos` rows and cannot see
  an `override` row — so correcting deliberately does **not** pin, because a pin freezes the
  whole day and swallows every cost entered afterwards. See
  [plans/finance-books-integrity.md](../plans/finance-books-integrity.md).
- (move closed items here with date + one-line note)
