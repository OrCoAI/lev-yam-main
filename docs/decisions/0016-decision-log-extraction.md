# 0016 — Extract dated decisions into an ADR log; slim CLAUDE.md

- **Date:** 2026-08-13
- **Status:** accepted
- **Decided by:** owner (strategy session with Claude Code)
- **Source:** `docs/plans/master-execution-plan.md` Part 1 #2; `docs/plans/lev-yam-gap-analysis-work-order.md` G2

## Context

From the work order: "Dated decisions live inline; CLAUDE.md is 326 lines and grows with each
one — every agent session pays the token cost, and decisions are hard to scan
chronologically." Decision discipline was rated "content excellent, *location* is the gap".

## Decision

- Create `docs/decisions/` holding one ADR file per dated decision (`NNNN-<slug>.md`), migrating
  every "(decided YYYY-MM-DD)" decision from `CLAUDE.md`, the plan files, and workflow comments.
  Keep the original rationale text; do not rewrite history.
- In `CLAUDE.md`, replace each migrated block with a one-line rule plus an ADR link.
- Standing rule: every future "actually, let's do X instead" becomes an ADR the same day;
  kickoff and close-out reference it.
- Fix the stale housekeeping line claiming `.claude/` is git-ignored: settings/local state are
  ignored, skills are versioned.
- Add `AGENTS.md` at the repo root as a pointer to `CLAUDE.md` and the `docs/` entry points —
  zero duplication, just portability for other agent harnesses (reaffirmed in ADR 0034 (d)).

## Consequences

- Acceptance: `CLAUDE.md` under ~180 lines; `docs/decisions/` chronologically complete; no
  decision content lost; `AGENTS.md` present and pointing, not duplicating.
- Sequenced first (with branch protection, ADR 0020) as "zero risk, immediate token savings".
- The `product-context` skill (ADR 0017) loads the newest ADRs before any product discussion,
  so this log becomes a live input rather than an archive.
- Deferred: a context/decision graph, triggered when the ADR count passes ~40 or
  `product-context` visibly dilutes (ADR 0034).
