# 0021 — Operating cadence; first quarterly review gates Phase 2

- **Date:** 2026-08-13
- **Status:** accepted
- **Decided by:** owner (strategy session with Claude Code)
- **Source:** `docs/plans/master-execution-plan.md` Part 1 #7 and Part 4; `docs/plans/lev-yam-gap-analysis-work-order.md` G7

## Context

The OS defines the owner's job as "approve specs (Gate 1), review outcomes (Gate 2), and one
judgment session per quarter". The cadence that makes that true existed only in the strategy
document, not in the repo's operating rules.

## Decision

Add an **Operating cadence** section to `CLAUDE.md`:

- Weekly review (automated, ADR 0018).
- Monthly roadmap review (automated agenda: triage digest, ideas batch, obs-best-practices audit).
- Quarterly vision + architecture review (human judgment on an agent-assembled evidence pack;
  ADR 0017 skill 6 + ADR 0018 quarterly-prep).
- **Queue-jumper rule:** evidence that a core bet is wrong interrupts anything; nothing else
  does — "that's the system working, not the system failing".

**The first quarterly review is the gate into Roadmap Phase 2 and its opening act.** It doubles
as the shakedown cruise for the new machinery (decision log, outcome metrics, cadence); its
output — VISION/ARCHITECTURE amendments or explicit no-change ADRs, plus Phase 2 priorities
written into `ROADMAP.md` — is the Phase 2 mandate.

## Consequences

- Phase 1 closes only when master-plan Steps 0–12 are merged, a Tier-C change has flowed to
  production untouched, all three crons have fired, and the environment shows green monitors,
  armed detectors, evaluating SLOs and one real SRG verdict.
- All H9.5 phases must be merged before the first quarterly review, so its architecture audit
  runs against a current-generation ecosystem.
- Acceptance: the section exists and the first quarterly review is completed, dated, with its
  ADRs merged.
- ADR 0034 (c) later adds a Session hygiene subsection to the same section.
