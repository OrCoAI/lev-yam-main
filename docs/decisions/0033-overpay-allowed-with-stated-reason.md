# 0033 — Overpaying an expectation is allowed with a stated reason stamped into the entry note

- **Date:** 2026-08-26
- **Status:** accepted (amends the partial-payments design of 2026-08-12)
- **Decided by:** owner (staging review) + Claude Code (review)
- **Source:** `docs/ROADMAP.md` "Partial payments" entry; `docs/plans/phase1-closeout.md` §B partial-payments bullet and close-out

## Context

The partial-payments work (Phase 1 close-out §B) added `paid_amount` to `finance.expected` and
made `record_payment()` compute the remainder instead of closing an expectation at any amount.
As designed on 2026-08-12 it flatly rejected any payment above the remainder. The staging review
found that production's history already contained a real overpayment, so the rule would have
refused to record what had actually happened.

## Decision

From the roadmap:

> overpay only with a stated reason stamped into the entry's note (softened from a flat refusal
> — owner decision 2026-08-26, staging review)

The as-executed amendment in the close-out plan:

> *(As-executed amendment 2026-08-26, from the staging review: overpay is **allowed with a
> required reason** rather than flatly rejected — the reason lands in the entry's note as
> `מעבר לצפי: <reason>` and the row closes at the overpaid total. Prod's history already
> held a real overpayment, so the flat refusal fought reality.)*

The close-out summary records the hardening that came with the review of the change:

> open rows can never carry `paid_amount > amount` (binds the owner too), the client sends
> `p_over_reason` only when overpaying (deploy-skew safety), and reconciliation no longer
> reports rows with nothing owed.

## Consequences

- `record_payment()` accepts `p_over_reason`; an overpay without a reason is still refused, and
  the reason is written into the posted entry's note, so the ledger explains itself.
- The client sends `p_over_reason` only when overpaying, because PostgREST matches RPCs by the
  named-argument set and an unconditional new parameter breaks during the app-before-SQL
  deploy window.
- Known follow-up: `record_payment` and `quotes.settle_on_paid` are parallel copies of the same
  payment machinery; the reason policy lives in one copy only, safe today by construction
  (settle posts exactly the remainder). A shared `finance.pay_expectation()` is the refactor
  candidate.
