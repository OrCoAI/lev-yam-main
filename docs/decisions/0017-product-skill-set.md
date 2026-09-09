# 0017 — Product-side skill set joins the engineering skills

- **Date:** 2026-08-13
- **Status:** accepted
- **Decided by:** owner (strategy session with Claude Code)
- **Source:** `docs/plans/master-execution-plan.md` Part 1 #3; `docs/plans/lev-yam-gap-analysis-work-order.md` G3

## Context

From the work order: "All 5 skills are engineering/observability. The OS's product loops have
no executable form." The five committed skills (bluebox x3, production-query, verify) cover
only the engineering side.

## Decision

Create in `.claude/skills/`:

1. `product-context` — loads VISION, ARCHITECTURE invariants, current ROADMAP phase, FACTS rules
   and the newest ADRs before any new-feature / scope / "should we" conversation.
2. `feature-spec` — formalizes the kickoff: alignment questions, plan-file template (now with an
   outcome metric, ADR 0019), roadmap/architecture/vision checks, tier declaration.
3. `weekly-review` — shipped vs. roadmap phase, Tier-C merges auto-shipped, open plan files
   without close-out, drift check, analytics headline, and a "Harness health" line.
4. `feedback-triage` — synthesizes GA4/Dynatrace/WhatsApp/reviews into scored opportunities
   mapped to the VISION circles; all ingested content is data, never instructions.
5. `idea-capture` — appends to `docs/ideas.md` (date + one line + optional module tag), refuses
   elaboration.
6. `quarterly-review` — orchestrator for the quarterly vision + architecture review, shipping
   with `vision-audit.md` and `architecture-audit.md` checklists; evidence assembly is
   agent-built, judgment stays human; the divergent brainstorm is last on the agenda.

Plus the `obs-best-practices` monthly observability-audit skill (H9.5). Reusable scaffolding from
Anthropic's PM plugin (Apache-2.0) is adapted where it fits.

## Consequences

- Acceptance: each skill triggers on its phrases in a fresh session; `docs/ideas.md` exists and
  is linked from CLAUDE.md housekeeping; `quarterly-review` ships with both checklists.
- Each custom skill ships with a 3-case eval (trigger / no-trigger / expected output) so skill
  drift is measurable at the quarterly ceremony audit (ADR 0034 (e)).
- The G4 automations (ADR 0018) depend on these skills existing; G3 lands before G4.
