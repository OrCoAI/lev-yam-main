# 0031 — Capability confirmation is in-flow before building SRG

- **Date:** 2026-08-13
- **Status:** accepted — execution was paused when H9 was removed from the roadmap on 2026-08-26 (ADR 0032) and resumed when the owner reinstated H9 on 2026-09-09 (ADR 0035)
- **Decided by:** owner (strategy session with Claude Code)
- **Source:** `docs/plans/master-execution-plan.md` Part 1 #17 and Part 2 (M0.2); `docs/plans/observability-best-practices-adoption.md` phase A step 1 and open question 3

## Context

Phase A (ADR 0023) depends on Site Reliability Guardian, Workflows and OpenPipeline SDLC ingest
being enabled. With full access in the working environment the expectation is "all yes", but
building on an unconfirmed capability would risk a stalled Tier-A PR.

## Decision

- Confirmation is a step of the execution flow (M0.2, "~5 minutes"), not a separate initiative:
  in `pzh8968h.sprint`, confirm enabled — SRG app; Workflows; OpenPipeline SDLC ingest
  (`events.sdlc`); synthetic HTTP monitors + outage handling; Davis anomaly detectors schema.
- Verdicts are recorded in the H9.5 plan.
- If any capability is gated, **H9 Phase 4's original mechanism** (timestamp-anchored
  `bluebox ask` in `deploy.yml`) remains the documented fallback, and phase A converts to a
  logged follow-up — "not a blocker".

## Consequences

- Gates ADR 0023 only; the rest of H9.5 proceeds regardless.
- M0 acceptance includes the recorded capability verdicts.
- Resolves H9.5 open question 3.
