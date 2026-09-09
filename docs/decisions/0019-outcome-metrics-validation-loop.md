# 0019 — Outcome metrics close the validation loop

- **Date:** 2026-08-13
- **Status:** accepted
- **Decided by:** owner (strategy session with Claude Code)
- **Source:** `docs/plans/master-execution-plan.md` Part 1 #5; `docs/plans/lev-yam-gap-analysis-work-order.md` G5

## Context

From the work order: "World-class signal collection (Dynatrace bizevents, GA4, Meta) with no
ritual reading it; plan close-outs verify alignment but not outcomes."

## Decision

1. Add an **"Outcome metric"** field to the plan-file template (`MODULE-TEMPLATE.md` + the
   `feature-spec` skill): every initiative names the number that will move and when it will be
   checked.
2. Add an **"Outcome check"** subsection to the close-out ritual: 2–4 weeks after ship, the
   `weekly-review` skill lists initiatives due for their check; the verdict is appended to the
   plan file.
3. The monthly triage issue includes a "shipped-but-unvalidated" list; per the OS it must
   never be deeper than one cycle.

## Consequences

- Definition of done becomes: telemetry (H9 Phase 5) + outcome metric (G5) + rollback plan
  (existing).
- Ownership split with H9: Phase 5 owns the "telemetry is part of done" template edit; G5's
  field lands **in or after** that PR (master plan Step 11, a single edit), never as a parallel
  edit to the same lines.
- Acceptance: template updated; at least the next initiative ships with a named outcome metric.
- Outcome-check verdicts from close-outs become the first item of the quarterly evidence pack.
