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

- Server-side provenance resolution — `source_ref` parsing currently lives client-side in
  `modules/finance/provenance.ts`; move into a DB view/generated column once a second
  surface (events module, dashboards) needs entry→quote/POS links. Deferred 2026-08-12 with
  that trigger named explicitly; finance is still the only consumer, via one shared helper
- Retire the quotes module's client-side-only `isWaitingPayment` derived status
  (`modules/quotes/types.ts`, added 2026-07-13) now that `finance.expected` tracks real
  receivables (`paid_amount`, 2026-08-12) — it is a UI-only stopgap (status + event_date, no
  due-date/deposit-vs-balance granularity) and is now a second, drifting source of truth
- Correction rows carry `payment_method = null` by design (`56_finance_override.sql`), so
  reversing a cash payment leaves `finance.report`'s `by_payment` cash column overstated
  while the totals stay right. Changing it alters `by_payment` semantics — needs a decision

## Done

- **2026-08-12 — partial payments, H6's guard, and the owner override.**
  [plans/phase1-closeout.md](../plans/phase1-closeout.md) §B.
  *Partial payments:* `record_payment()` closed an expectation at **any** amount — ₪1 against
  a ₪5,000 deposit marked it paid and the remaining ₪4,999 disappeared from the plan side
  (open list, open-expected total, and reconciliation's overdue check all stopped seeing it).
  Now `finance.expected.paid_amount` tracks what has arrived, the form defaults to the
  remainder, overpaying is refused, and each payment posts its own `expected:<id>:pN` entry —
  a fixed ref would have collided on the posting unique index. `quotes.settle_on_paid` settles
  only the remainder (it would otherwise double-post a part-paid deposit at full value when a
  quote flips to `paid`), and reconciliation reports what is still owed.
  *H6:* module-sourced expectations became status-only for `finance.manage` holders. The
  prescribed fix (`assert_category_writable()` inside `record_payment`) would have **rejected
  the quotes module's own money path** — `events` is `owned_by_module='quotes'` and every
  quotes deposit files under it — so it landed as an owner-vs-poster predicate instead.
  *Owner override:* the owner is exempt from both guards and every such edit is recorded in
  the new `finance.audit_log` (readable at `finance.view`, trigger-written, no client write
  policy, verified un-forgeable and un-erasable). That also replaced the separately-planned
  expectation re-open path — the owner can simply reset the row, audited.
  `provenance.ts` gained `:pN` tolerance in the same change: it required a bare UUID after
  `expected:`, so the new grammar would have silently killed every quote link on a part-paid
  deposit. 14 new `rls_matrix` assertions; suite green.

- **2026-08-05 — `/code-review high` findings on the books-integrity branch.** Four fixed:
  the drift roll-up was a *signed* sum across all four legs (revenue + cost with the same
  sign), which also reported a +100 cash / −100 card drift as "0" — it is now a magnitude,
  pinned by an rls_matrix assertion; a dead `pos_pinned` field whose comment described the
  auto-pin PR C deliberately dropped; the entries list snapping back to page 1 after a
  correction, which hid both the corrected row and the new one on a long ledger (`load()`
  gained `keepWindow`); and the Expected-tab focus effect re-firing on every load inside its
  2.5s window, yanking the viewport back. Fifth (archived categories) below.
- **2026-08-05 — archiving a category now also blocks new *expectations*.**
  `assert_category_writable()` only ran from `finance.entries_guard()`, so `active = false`
  meant "no new manual entry" while a new `finance.expected` row could still be filed under
  an archived category through the API and would post an entry under it on fulfilment. New
  `finance.expected_guard()` trigger mirrors the entries rules on the plan side, with a
  carve-out letting a module file under a category **it** owns (quotes → `events`). Note
  `new.kind` is unusable there: it is `GENERATED STORED`, which Postgres computes *after*
  before-row triggers, so the guard derives the kind from `direction` itself. Deliberately
  unchanged: fulfilling an expectation already open under a since-archived category still
  works — that money was planned before the archive.
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
