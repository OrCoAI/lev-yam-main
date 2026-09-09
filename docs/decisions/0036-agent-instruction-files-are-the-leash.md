# 0036 — Agent-instruction files are one "leash" class, all Tier A

- **Date:** 2026-09-09
- **Status:** amends 0015 and 0022 — proposed by Claude Code during the Step 2 gate; the owner confirms or amends at the Step 2 (Tier A) sign-off
- **Decided by:** owner + Claude Code (review) — owner confirmation pending
- **Source:** `/simplify` altitude finding on `scripts/check-tier.mjs`; work order G1 vs G8

## Context

Work order G1 puts "docs" in Tier C; G8 makes `.claude/settings.json` "Tier A forever — an agent
never silently edits its own leash." Read literally, the first tier-check rule set mapped
`CLAUDE.md`, `AGENTS.md` and `.claude/skills/**` to Tier C: a PR could rewrite the risk-tier
table, the gate, or the staging pre-authorization and merge on green with zero human eyes — the
exact scenario G8 exists to prevent, one directory over. The two work-order items contradict each
other on what "the leash" is.

## Decision

The leash is a **class**, not a file: `.claude/**` (settings and skills), every `CLAUDE.md`
(root or nested), `AGENTS.md`, `.mcp.json`, `.gitignore` (the publication allowlist of a public
repo), `scripts/check-tier.mjs` (the rule set itself), `scripts/verify/` (the gate harness) and the
PR template are **Tier A**. Rationale: these files define what agents may do and how work is
gated; changing them changes every later PR's review depth. ADRs and other `docs/` stay Tier C —
they record decisions, they do not enforce them.

## Consequences

- The master plan's own Steps 5 (skills), 11 and 12 (CLAUDE.md edits) are Tier A: the owner
  reviews them in full. That is the intended cost.
- `scripts/check-tier.mjs` lists the leash rules first — before every exception — so no pattern can
  demote them; CLAUDE.md's tier table names the class.
- The tier check is its own workflow (`tier.yml`, pull requests only) and its own required status
  check next to `build`: a push-event run — which cannot read a PR body, and whose skipped job
  would still count as passing — never produces a check run with that name.
- If the owner amends this (e.g., skills → B), the script rule and this ADR change together.
