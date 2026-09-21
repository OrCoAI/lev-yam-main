# 0020 — Mechanical rails: branch protection, money-math tests, lint

- **Date:** 2026-08-13
- **Status:** accepted — amended by ADR 0037 (linter and money-math test target)
- **Decided by:** owner (strategy session with Claude Code)
- **Source:** `docs/plans/master-execution-plan.md` Part 1 #6; `docs/plans/lev-yam-gap-analysis-work-order.md` G6

## Context

From the work order: "Currently the 'process violation' rule is honor-system; autonomy requires
it be mechanical." G6 is the prerequisite for Tier C (ADR 0015) being trusted; the master plan
lists it as "mechanical rails first".

## Decision

1. **Branch protection on `main`** (GitHub settings — owner action, not repo code): require PR,
   require `ci.yml` green, no direct pushes, admins included. Documented in
   `docs/ARCHITECTURE.md`.
2. **Unit tests for money-math:** vitest in `app-src` covering `modules/pos/logic.ts` and
   `modules/finance/reconciliation.ts` ("pure functions — cheapest, highest-value tests in the
   repo"), wired into `ci.yml` before the build step.
3. **Lint:** eslint (existing Vite+TS preset) in `ci.yml`.
4. The dependabot known gap (Deno `@simplewebauthn/server`) becomes a quarterly checklist item
   in the weekly-review skill's monthly section instead of "a comment in a YAML file nobody
   re-reads".

## Consequences

- Acceptance: a direct push to `main` is rejected; `npm test` exists and runs in CI; the lint
  gate is active.
- Complements, does not replace, H9 Phase 3's reconciliation-as-monitor: unit tests prove the
  reconciliation *logic*, the monitor proves *production data* still satisfies it.
- Owner touchpoint: confirm the branch-protection setting in the GitHub UI (or grant admin `gh`
  scope).
