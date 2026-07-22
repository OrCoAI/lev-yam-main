# POS — day lifecycle: write to books + auto re-post (PR E)

Fifth PR of [pos-operations-v2.md](pos-operations-v2.md). Covers request **#5**. Stacked on
PR C (split payments) and merged together with it — C changes how money reaches the books,
E is the safety net that keeps the books correct after any later change.

Module: `app-src/src/modules/pos/`. Schema: new `supabase/schema/48_pos_day_lifecycle.sql`
(+ a small edit to `47`'s `pos_close_table`).

## Locked decisions (owner, 2026-07-22)

- **First write to the books is manual** — a manager taps "record day to finance"
  (`pos.close_day`, as today). That's the deliberate "the day is done" act.
- **Corrections after that are automatic** — if a booked day's money changes afterward, the
  posting re-runs itself and writes the correcting delta. *(Revised from the original
  "flag + manual re-post" — owner: "the update should take in place".)*
- **Notify = report badge + finance correction entry.** The day's report shows a "books
  updated since posting" badge; finance gets the delta entry labelled תיקון (as today). No
  push infrastructure.

## Mechanism

`pos.post_day` (PR C) already holds the idempotent posting logic with no permission check.
E wires it to fire automatically:

- `pos.day_is_posted(date)` — does finance already hold `pos:<date>:*` entries.
- `pos.repost_if_posted(date)` — if posted, `perform pos.post_day(date)` (writes only the
  delta; a no-op when nothing changed).
- `pos.autorepost()` — an `AFTER INSERT/UPDATE/DELETE` **row trigger** on `pos.pos_payments`
  and `pos.pos_expenses` (the only tables `post_day` reads). It resolves the affected
  business date(s) — `taken_at`→Jerusalem date for payments, `business_date` for expenses,
  both OLD and NEW on an update — and calls `repost_if_posted` for each. Skips when
  `levyam.suppress_repost` is set.
- `pos.pos_close_table` sets `levyam.suppress_repost` for its body (so its multi-row payment
  writes don't each fire a re-post) and calls `repost_if_posted(bill_date)` once at the end.
  For a normal same-day close the day isn't posted yet, so this is a no-op — zero overhead.

`pos_bills` needs **no** trigger: `post_day` derives cash/card from payments and food/labor
from expenses, never from bills. Recursion is impossible — `post_day` writes only
`finance.entries`, which no POS trigger watches.

## UI

- `pos.day_status(date)` (reports-gated) → `{ posted, corrected }`.
- `ReportView`: when a single day is in view — **not posted** → the existing "record day to
  finance" button; **posted** → a status badge (✓ נרשם / ⟳ עודכן מאז הרישום when corrections
  exist). The manual re-post button is retired once posted — corrections are automatic.

## Roles

`day_status` = `pos.reports`. `day_is_posted` / `repost_if_posted` / `autorepost` are internal
(revoked from every role; the trigger runs as its definer owner). `post_day` stays internal
(PR C). First manual post stays `pos.close_day` = `pos.manage`.

## Gate

Full gate + `rls_matrix` (`day_status` reports-gated) + a functional test: post a day, then
change an expense/payment on it and assert finance auto-corrects to the new total.

## Close-out — shipped 2026-07-22 (PR #29, merged + deployed)

Delivered as designed: manual first post, then automatic delta re-post on any change to a
booked day; report badge (✓ booked / ⟳ updated). Finance-spine negative-reversal fix landed
in 20/21.

**Same-day hotfix (commit 4aab7dd)** — owner hit "added an expense on a closed date, not able
to add to the books." Root cause: PR C's `post_day` derived revenue only from `pos_payments`,
but every pre-split-payments bill (and every bill the then-deployed 2-arg client closed) has
money only on `pos_bills` with no payment rows — so re-posting such a day recomputed revenue
as ~0 and auto re-post booked a giant negative correction, wiping the day's income. Fix:
`post_day` sums revenue from **both** sources (payments + payment-less bills via the pre-PR-C
grammar), so re-posting an untouched legacy day is a true no-op. `/code-review` follow-on:
`post_day` now reads `pos_bills`, so added `pos_bills` auto-repost triggers (INSERT/DELETE;
UPDATE only on revenue columns) + extended the close re-post loop to the bill's `paid_at` day.
No prod data was corrupted (caught pre-commit); two stale food-cost days (07-17, 07-18)
reconciled. Full multi-agent gate green.

**Follow-up logged** (`docs/modules/pos.md`): fold the two revenue sources behind a single
`pos.day_revenue(p_date)` view so `post_day` stays source-agnostic — deferred, not weekend
work; do **not** backfill `pos_payments` for history (irreversible live-money risk).

**Alignment:** serves VISION (money integrity, "everything through the system") and holds the
ARCHITECTURE invariants — DB-first RLS, finance posted only via the module posting fn through
the `levyam.finance_posting` gate, corrections as reversals (never edits), bilingual UI. No
drift.
