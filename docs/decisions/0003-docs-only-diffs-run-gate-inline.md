# 0003 — Docs-only diffs run the pre-commit gate inline (diff-class scaling)

- **Date:** 2026-07-11
- **Status:** accepted
- **Decided by:** owner + Claude Code (review)
- **Source:** `CLAUDE.md` "Pre-commit quality gate", paragraph "Diff-class scaling (decided 2026-07-11)"

## Context

The pre-commit gate is mandatory for every commit because `main` deploys straight to production.
Its review steps (`/simplify`, `/code-review high`, `/security-review`) fan out to agents at high
effort. Applied uniformly, a change that only touches `docs/` or `CLAUDE.md` paid the full
multi-agent cost for a diff with no runtime, schema, or deployed surface. `/verify` already had a
docs-only carve-out ("Skip only for diffs with no runtime surface").

## Decision

The gate scales by diff class. Quoted from `CLAUDE.md`:

> **Diff-class scaling (decided 2026-07-11):** for diffs with **no runtime or schema
> surface** (docs-only), run steps 1–2 **inline** — the reviewing model does each pass
> itself, no agent fan-out — the same carve-out step 3 already has. The full multi-agent
> gate at high effort stays mandatory for any diff touching `app-src/`, `supabase/`, any
> file in `deploy.yml`'s site allowlist, or `.github/workflows/`.

The gate itself is not optional for any class: "This gate applies to **every** commit."

## Consequences

- Docs-only commits still get all three review passes, done inline by the reviewing model;
  only the agent fan-out is dropped.
- The boundary is defined by paths, not judgement: `app-src/`, `supabase/`, the deploy
  allowlist, and `.github/workflows/` always trigger the full tier.
- The same path set was later reused as the scope of mandatory staging verification
  (ADR 0012), so "full gate tier" and "needs staging" mean the same diffs.
