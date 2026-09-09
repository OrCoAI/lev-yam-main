# 0028 — Query hygiene codified as defaults, not constraints

- **Date:** 2026-08-13
- **Status:** accepted — execution was paused when H9 was removed from the roadmap on 2026-08-26 (ADR 0032) and resumed when the owner reinstated H9 on 2026-09-09 (ADR 0035)
- **Decided by:** owner (strategy session with Claude Code)
- **Source:** `docs/plans/master-execution-plan.md` Part 1 #14; `docs/plans/observability-best-practices-adoption.md` phase F

## Context

With the working environment's budget unconstrained (ADR 0029), cost-discipline items are
"hygiene defaults, not constraints: follow them where free, relax them where they'd cost
simplicity." The hygiene still needs a written home so detectors and dashboards are built
cleanly by default.

## Decision

Standing rules in `CLAUDE.md` / the plan:

- `timeseries` over ingested metrics is free; `fetch ... | makeTimeseries` is for dashboards
  and on-demand analysis only, never for 1-minute detectors.
- Frequently-run aggregations become OpenPipeline-extracted metrics.
- Bizevents cannot be backdated more than 24h — this constrains any future buffering/replay
  design.
- Clean, narrow, repeatable queries are the default; budget is not a constraint in this
  environment.

## Consequences

- Docs-only carve-out; "F is minutes". Lands with master plan Step 10.
- Detector authoring under ADR 0024 follows these rules by construction.
- The `obs-best-practices` monthly skill audits the repo's queries against these rules and
  against the tools' current guidance.
