# 0015 — Risk tiers A/B/C replace uniform triple sign-off

- **Date:** 2026-08-13
- **Status:** accepted — amended by ADR 0036 (the leash class is Tier A; tiers gate human checkpoints only — gate effort stays per ADR 0003, kickoff per initiative)
- **Decided by:** owner (strategy session with Claude Code)
- **Source:** `docs/plans/master-execution-plan.md` Part 1 #1; `docs/plans/lev-yam-gap-analysis-work-order.md` G1

## Context

From the work order: "Every qualifying diff requires the owner's explicit sign-off three times
(kickoff alignment, localhost UI confirmation, staging sign-off). Safe, but rebuilds the PM
bottleneck in miniature; blocks the autonomy goal." The session called this the highest-impact
gap: "risk tiers A/B/C replace sign-everything".

## Decision

A **Risk tiers** section in `CLAUDE.md` (referenced from `docs/ARCHITECTURE.md`), with the tier
declared per PR and checked against the changed paths in CI:

- **Tier A — full current process (all three checkpoints):** any diff touching `supabase/`
  (schema, RLS, functions), auth/passkeys, the finance/events spine, `.github/workflows/`,
  the `scripts/assemble-site.sh` allowlist, payment-adjacent POS logic.
- **Tier B — one human checkpoint:** new UI features/flows on live modules. The gate runs in
  full; the human look happens once, on staging. Claude's own headless screenshots remain step
  zero; the separate localhost sign-off is dropped.
- **Tier C — zero human checkpoints:** copy/i18n text, styles, docs, tests, dependabot bumps,
  `/stories/` pages that pass the twin-rule generator. Full gate + CI + staging deploy still run;
  merge proceeds on green without waiting for sign-off, and a Tier-C merge notice lands in the
  weekly report.

Every PR description declares its tier plus a one-line justification; a path-based check
script in `scripts/`, run by `ci.yml`, verifies the declaration. The existing docs-only inline
carve-out becomes part of Tier C.

## Consequences

- Tiers apply only after the G1 PR itself merges through the full current process; from then on
  every PR (including the master plan's own) self-declares a tier.
- The first two weeks after tiers land are a calibration period: the owner watches Tier-B PRs
  closely while trust builds; Tier A always gets full review.
- Acceptance: a Tier-C change reaches production with zero owner interactions after the request;
  a `supabase/` diff still requires all three checkpoints.
- Depends on the mechanical rails of ADR 0020 (branch protection) being in place first.
