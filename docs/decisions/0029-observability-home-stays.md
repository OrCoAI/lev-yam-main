# 0029 — Production observability home stays; no tenant migration

- **Date:** 2026-08-13
- **Status:** superseded by ADR 0038 (2026-09-14: the sprint environment was deactivated; a new dedicated environment is the home)
- **Decided by:** owner (strategy session with Claude Code)
- **Source:** `docs/plans/master-execution-plan.md` Part 1 #15 (marked REVISED) and Part 2; `docs/plans/observability-best-practices-adoption.md` "Standing context" and open question 1

## Context

The H9.5 plan originally carried an open question, "Which tenant?", with a possible migration
of production observability to a new tenant. During the session the owner revised this: they
have full access and an unconstrained budget in their current working environment, so a
migration would buy nothing and would cost the existing RUM tag, bizevents and baselines.

## Decision

- The production observability home **remains the current working environment
  `pzh8968h.sprint`** (dtctl context `my-env`). **No tenant migration.**
- Existing RUM tag, bizevents, H9 Phase 0 baselines (~8 CTAs, ~27 sessions/day) and all
  environment references stand as they are.
- The **Bluebox environment `tgo73062` stays separate**, per `docs/ARCHITECTURE.md` §6b: it
  receives the edge functions' OTel telemetry and hosts the SLO/alert objects created there
  (ADR 0030); the working environment hosts marketing RUM, bizevents, detectors and dashboards.
- Budget is unconstrained in the working environment; cost rules are hygiene only (ADR 0028).

## Consequences

- H9.5 open question 1 is resolved; every H9 / H9.5 phase targets `pzh8968h.sprint` (plus
  `tgo73062` where Bluebox objects are concerned), and OpenPipeline masking (ADR 0025) is
  applied in both.
- M0 (master plan Part 2) reduces to access and capability confirmation — no migration
  workstream exists.
- Any future proposal to move tenants is a new ADR superseding this one.
