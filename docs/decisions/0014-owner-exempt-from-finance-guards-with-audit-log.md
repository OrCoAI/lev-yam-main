# 0014 — The owner is exempt from the finance module-row guards, with every such edit recorded in finance.audit_log

- **Date:** 2026-08-12
- **Status:** accepted
- **Decided by:** owner + Claude Code (kickoff of the Phase 1 close-out)
- **Source:** `docs/ROADMAP.md` H6 entry ("Owner decision 2026-08-12"); `docs/plans/phase1-closeout.md` locked-scope table and §B

## Context

Roadmap H6 closed a hole in `finance.expected_guard()`: a `finance.manage` holder could freely
change amount, due date, reason, `event_id` or `fulfilled_by` on a quotes-created expectation,
silently breaking its pairing with a signed quote. Locking those rows down completely, however,
would leave nobody able to correct a deposit the quotes module got wrong. The prescribed fix
(`assert_category_writable`) also could not be used, because it "would have rejected the quotes
module's own primary money path".

## Decision

From the roadmap H6 entry:

> **Owner decision 2026-08-12:** the owner is exempt from both guards — quotes can get a
> deposit wrong and the owner must be able to correct it — with every such edit recorded in
> the new `finance.audit_log` (readable at `finance.view`, trigger-written, no client write
> policy). That also subsumed the separately-planned expectation re-open path.

The locked-scope table in the close-out plan states the boundaries:

> **Owner may edit any field on a module-created expectation AND record a payment into any
> category.** Managers (`finance.manage`) stay restricted. **Derived `finance.entries` stay
> immutable** — corrections there keep going through PR C's additive override (§7.4 preserved).

> **New `finance.audit_log`**, readable by `finance.view` holders, trigger-written only. Not
> `core.audit_log` — that is identity-scoped and readable only by `users.manage`.

## Consequences

- Module-sourced expectations are status-only for managers (jsonb allow-list guard); the owner
  (`finance.override`) may edit anything, and every client edit to such a row (owner override or
  a manager's cancellation) lands in `finance.audit_log`, kept deliberately after measuring 3
  rows where 1 was expected.
- The exemption uses the owner-vs-poster predicate `finance.assert_category_writer()`, which
  deliberately does not consult `active`.
- "Re-open after a correction" is `status='open', paid_amount=0` under the exemption, pinned by
  an `rls_matrix` assertion; no dedicated function.
- Accepted tension, recorded as a follow-up: the owner can fulfil a part-paid expectation and
  thereby forgive the remainder with the audit row as the only trace (implicit write-off).
