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

- Archiving a category does not stop a **new `finance.expected` row** from being created
  under it via the API. `finance.assert_category_writable()` runs from
  `finance.entries_guard()`, and `finance.expected` has no equivalent guard — only the
  composite FK, which checks that the category *exists*, not that it is still active. Not
  reachable from the UI (`pickableCategories` offers active, non-module categories only),
  and not a privilege boundary (anyone who can do it already holds `finance.manage` and
  could file the money under an active category instead) — so it is data hygiene, not
  security. Closing it means an insert/update trigger on `finance.expected` that mirrors
  the entries guard, including how a module-created expectation is allowed to keep using
  its own module-owned category. Found by `/code-review high`, 2026-08-05.
  *Not* a bug, by decision, and documented at both call sites: archiving does not block
  `record_payment()` from fulfilling an expectation **already open** under the category.
  That money was planned before the archive; refusing it would strand it.

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

- **2026-08-05 — per-module drift badges.** The POS tile showed the *global* drift count, so it
  advertised problems POS cannot solve (Or, on staging: "why in the pos it is marked like 2?" —
  1 unposted day + 1 overdue deposit). Each drift item now names the module responsible for it
  and `reconciliation_counts()` returns a module→count map; quotes gets badged for an overdue
  deposit it created. The shell no longer names any module, so a new module badges itself by
  writing its own provenance. Note the badge still renders only for `finance.view` holders — a
  drift count is financial information.
- **2026-08-03 — two bugs found by Or on staging, fixed.**
  (1) The owner-correction `±` button "did nothing": `CorrectionForm` renders at the *top* of
  the entries tab, but unlike `startEdit` the correction path never scrolled, so clicking a row
  low in the ledger opened the form off-screen above. Both forms now scroll into view and are
  mutually exclusive (two money forms stacked over one list invites typing into the wrong one).
  The RPCs were never at fault — verified through PostgREST.
  (2) Updating צפי did not refresh the התאמה tab: `useReconciliation` fetched once on mount and
  nothing re-read it after `record_payment`, so a paid deposit stayed listed as overdue. The
  reconcile tab now re-reads on entry (it promises a *live* answer, and money moves from
  anywhere — the POS module, a colleague's phone), and ExpectedTab notifies the module after
  fulfil/cancel so the banner updates without waiting for a tab switch.
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
