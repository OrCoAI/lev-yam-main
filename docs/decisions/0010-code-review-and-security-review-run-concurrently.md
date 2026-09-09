# 0010 — /code-review high and /security-review run concurrently in the gate

- **Date:** 2026-08-12
- **Status:** accepted
- **Decided by:** owner + Claude Code (review)
- **Source:** `CLAUDE.md` "Pre-commit quality gate", step 2

## Context

The gate's review steps ran in sequence: `/simplify`, then `/code-review high`, then
`/security-review`, then `/verify`. `/simplify` must run first and alone because it edits the
working tree, and `/verify` must run last because it needs final code. The two middle passes,
however, are both read-only findings passes over the same diff, and serializing them only
added wall-clock time to a gate that is already several high-effort passes.

## Decision

Quoted from `CLAUDE.md`:

> 2. **`/code-review high`** + **`/security-review`** — run **concurrently** (decided
>    2026-08-12): both are read-only findings-passes over the same post-simplify diff with no
>    dependency on each other, so serializing them only cost time. Collect findings from both
>    before fixing anything; if a fix for one touches code the other already cleared, re-run
>    that one too. All findings from both resolved before moving on.

The ordering constraints around them are unchanged: `/simplify` "Runs first and alone: it
applies fixes directly to the working tree, so steps 2–3 must review the diff it produces, not
the one before it", and `/verify` "Runs last: it needs the final code."

## Consequences

- Both reviews are launched together on the post-simplify diff and their findings are collected
  before any fix is applied, so one pass's fix cannot invalidate the other's clearance unseen.
- A fix that touches code the other pass already cleared triggers a re-run of that pass.
- Effort level is unaffected: both still run at `high` on the most capable model available.
- The gate's guarantee (every finding resolved before commit) is the same; only elapsed time
  drops.
