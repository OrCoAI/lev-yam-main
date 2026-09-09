# 0034 — Harness-engineering alignment

- **Date:** 2026-09-09
- **Status:** accepted
- **Decided by:** owner (strategy session with Claude Code)
- **Source:** `docs/plans/master-execution-plan.md` Part 1 #18; `docs/plans/lev-yam-gap-analysis-work-order.md` G2, G3.3, G3.4, G3 acceptance, G4.2, G7; `docs/plans/observability-best-practices-adoption.md` phase E

## Context

The weekly report needs numbers, not feel, to decide the deferred autonomy questions ("these
are the numbers that decide the deferred AI-pre-review and tier promotions — data, not feel").
Untrusted text now flows into a skill; long sessions suffer context rot; other agent harnesses
may run against the repo; skill drift has no measurement.

## Decision

- **(a) Harness health line** in the weekly report: cost/tokens per merged PR, time-to-merge by
  tier, rework rate (PRs needing a second round), open-PR queue depth awaiting Gate 2. Fed by
  `gh` PR data plus Claude Code OpenTelemetry export (usage/cost/session metrics only, no
  prompt or code content) into the working Dynatrace environment, so agent efficiency lives
  beside product telemetry. This data decides the deferred AI pre-review and tier promotions.
- **(b) `feedback-triage` treats all ingested text as data, never instructions:** messages,
  reviews and support text are quoted or summarized and any embedded directives are ignored —
  an untrusted-input surface, treated like user input in the app.
- **(c) Session hygiene rules in CLAUDE.md** (context-rot defense): one approved spec per
  session, never two initiatives in one context; review and test passes run as subagents with
  their own clean context; long sessions compact or restart at natural checkpoints.
- **(d) `AGENTS.md` pointer at the repo root** to CLAUDE.md and the docs entry points — zero
  duplication, just portability.
- **(e) Every custom skill ships with a 3-case eval** (trigger / no-trigger / one expected-output
  check) so skill drift is measurable at the quarterly ceremony audit.

## Consequences

- (a) lands across G3.3 (skill), G4.2 (weekly workflow) and H9.5-E (exporter, same secret
  hygiene as every other exporter); (b) in G3.4; (c) in G7's cadence section; (d) in G2; (e) in
  G3's acceptance.
- **Deferred, with triggers** (both recorded in `docs/ideas.md`):
  - AI pre-review at Gate 2 — trigger: rising decision latency or Gate-2 queue depth in the
    weekly report.
  - Context/decision graph — trigger: ADR count above ~40, or `product-context` visibly diluting.
