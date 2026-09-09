# 0002 — Supabase PITR (paid tier) deferred until 20 signed contracts

- **Date:** 2026-07-10
- **Status:** accepted
- **Decided by:** owner
- **Source:** `docs/plans/platform-hardening.md` H7 "Backups/PITR" bullet and open question Q1; `docs/ROADMAP.md` H7 entry

## Context

The 2026-07-10 best-practices audit (roadmap H7 batch) flagged backups: with the quotes module
migrated, signed legal contracts and the business ledger now live in the production Supabase
project, which runs on the free tier without point-in-time recovery. `docs/ARCHITECTURE.md` §2
carried a "verify PITR as data grows" line with no trigger attached.

## Decision

The paid-tier upgrade is deferred behind a concrete, checkable threshold. From the hardening plan:

> **Backups/PITR** — signed legal contracts + the business ledger now live in this DB;
> upgrade to a plan with PITR/daily backups and update the "verify PITR as data grows" line
> in ARCHITECTURE.md §2 to the decided posture. **Owner decision (2026-07-10): deferred —
> revisit when `quotes.contracts` reaches 20 signed rows** (check: `select count(*) from
> quotes.contracts where status = 'signed'`; raise it with the owner again at that point).

> **Q1 (H7-PITR):** *decided 2026-07-10 — deferred until 20 signed contracts; the check +
> reminder rule lives in the H7 bullet above.*

The roadmap keeps it visible as the one open H7 item: "**PITR stays parked** by the
20-signed-contracts rule — the one open item, tracked in the plan."

## Consequences

- The cost decision is tied to the data actually at risk, not to a calendar date.
- The count is the trigger: whoever sees `quotes.contracts` signed rows reach 20 raises it with
  the owner again. At the Phase 1 close-out (2026-08-26) it stood at 3/20.
- Until then, data protection rests on Supabase's automated free-tier backups plus git for code;
  the architecture doc's backup line stays qualified rather than claiming PITR.
