# Finance — module log

Live at `/app/finance`. Schema: `supabase/schema/20_finance.sql`,
`21_finance_spine.sql`. UI: `app-src/src/modules/finance/`.
Background: [plans/finance-ux-pass.md](../plans/finance-ux-pass.md),
[plans/cross-module-foundation.md](../plans/cross-module-foundation.md).

See [README.md](README.md) for how this file works — bugs/small features only; anything
touching schema, permissions, or the events/finance spine graduates to a `docs/plans/` plan.

## Open bugs

- (none logged)

## Open feature ideas

- Partial payments on `finance.expected` — `record_payment` currently closes the
  expectation at any amount; needs remainder/split support (carried over from the
  2026-07-09 UI-pass review, see ROADMAP Phase 1 finance follow-ups)
- Reversal path for posted entries with no owning module (hand-created expectations get
  `source='finance'` and are immutable with no corrector today)
- Server-side provenance resolution — `source_ref` parsing currently lives client-side in
  `modules/finance/provenance.ts`; move into a DB view/generated column once a second
  surface (events module, dashboards) needs entry→quote/POS links

## Done

- (move closed items here with date + one-line note)
