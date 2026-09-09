# 0018 — Automation layer: @claude action and scheduled review issues

- **Date:** 2026-08-13
- **Status:** accepted
- **Decided by:** owner (strategy session with Claude Code)
- **Source:** `docs/plans/master-execution-plan.md` Part 1 #4; `docs/plans/lev-yam-gap-analysis-work-order.md` G4

## Context

From the work order: "Only dependabot runs unattended. No issue→PR path from mobile, no
recurring reports; analytics are collected but never read back."

## Decision

1. Install the **Claude Code GitHub Action** (`.github/workflows/claude.yml`, API key as a repo
   secret, `allowed_tools` scoped to build/test commands): an issue filed from a phone yields a
   branch + PR through the normal gate, with a mandatory tier declaration.
2. **Weekly report workflow** — cron **Sun 17:00 UTC**, runs `weekly-review` headless, opens a
   `Weekly review YYYY-WW` issue. The report carries a "Harness health" line and an
   **"Alerts & problems" line** reading open Dynatrace problems and Bluebox alerts/Routine
   findings from the week.
3. **Monthly triage workflow** — cron **1st of month**, runs `feedback-triage` against exported
   analytics (GA4 CSV via API if credentials exist, else the skill tells the owner what to paste),
   opens `Monthly roadmap review YYYY-MM` with the digest, parking-lot batch and the
   obs-best-practices audit section.
4. **Quarterly prep workflow** (`quarterly-prep.yml`) — cron **1st of Jan/Apr/Jul/Oct**, runs the
   evidence-pack half of `quarterly-review` headless, opens `Quarterly review YYYY-Q` with the
   evidence and agenda checklist. The review session itself is never run unattended.
5. Keep dependabot; its PRs are Tier C, auto-merged on green once ADR 0015 lands.

## Consequences

- Platform-internal alerting stays the rule (no new real-time channel); the weekly line is the
  "weekly-eyes guarantee". If that proves too slow in practice, that is exactly the trigger H9
  logged for adding an external channel later.
- The weekly report reads and links the Bluebox Routine's findings; it never re-implements them.
  H9 Phase 4's deploy verification counts toward the automation inventory; G4 adds nothing on top.
- Full zero-prompt autonomy (`bypassPermissions`) lives only in these ephemeral CI runners,
  never on the laptop (ADR 0022).
- Acceptance: an `@claude` comment on a test issue yields a PR; all three cron workflows produce
  their issues on manual `workflow_dispatch`. Owner touchpoint: the Anthropic API key secret.
