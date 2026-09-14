---
name: quarterly-review
description: >
  Orchestrate the quarterly vision + architecture review: assemble the evidence pack
  (close-out and outcome verdicts, weekly-report trends, monthly digests, analytics
  trajectory, ideas deferred upward), enforce the agenda — vision audit, architecture audit,
  the one sanctioned divergent brainstorm LAST, converge — and write the outputs back (ADRs,
  VISION/ARCHITECTURE amendments, next-quarter priorities in ROADMAP.md). The human does the
  judgment; the skill does collation and agenda. The FIRST quarterly review is the gate into
  Roadmap Phase 2 (ADR 0021). Triggers: "quarterly review", "vision audit", "architecture
  audit", "evidence pack", "Q-review", "quarter planning".
metadata:
  version: '0.1.0'
---

# Quarterly review

Two halves, never mixed:

- **Evidence pack — agent-built, headless** (the `quarterly-prep` Action runs this half and
  opens `Quarterly review YYYY-Qn` with the pack and the agenda as a checklist). Spec:
  [evidence-pack.md](evidence-pack.md).
- **The review session — human at its core.** 2–3 hours of the owner's judgment on the pack;
  the skill only enforces the agenda and records outcomes. **Never run unattended.**

## Agenda (in this order — dreaming happens on top of evidence, not before it)

1. **Vision audit** — walk `docs/VISION.md` claim by claim with
   [vision-audit.md](vision-audit.md). Verdict per principle: **hold / amend / retire**. Every
   amendment is an ADR; an explicit "no change" is a recorded outcome (an ADR too), not a
   skipped step.
2. **Architecture audit** — walk `docs/ARCHITECTURE.md` invariants against everything
   shipped this quarter with [architecture-audit.md](architecture-audit.md): tech-debt
   inventory, the quarterly security checklist (permanent home of the
   `@simplewebauthn/server` Deno gap), the capacity question ("what breaks at 5× usage?"),
   the **ceremony audit** (are gate + tiers still proportionate? has trust earned a tier
   adjustment? — read the Harness-health trend), and the **observability generation check**
   fed by the monthly `obs-best-practices` audits.
3. **Sanctioned divergent brainstorm** — last. 30 minutes, no evaluation while diverging;
   inputs are the audits' findings and the ideas deferred upward from `docs/ideas.md`.
   Output: candidates for next quarter, each with the outcome it would move.
4. **Converge** — the owner picks. Outputs, written the same day:
   - ADRs for every amendment and every explicit no-change (`docs/decisions/`).
   - `docs/VISION.md` / `docs/ARCHITECTURE.md` edits where amended.
   - **Next-quarter priorities into `docs/ROADMAP.md`** — this is the mandate; for the first
     review it is the Phase 2 mandate.
   - A dated `## Close-out` on the review's own plan/issue with the alignment verdict.

## Rules
- The pack is assembled from files and commands (`weekly-review` reports, plan close-outs,
  `docs/ideas.md`, GA4/Dynatrace exports) — never from memory.
- Nothing in the pack is a decision. The skill proposes wording for ADRs only after the
  owner has decided.
- A finding that contradicts a core bet does not wait for the quarter — that is the
  queue-jumper, raised the day it is found.
