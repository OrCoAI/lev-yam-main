# 0012 — Staging verification is mandatory before merging to main; pushes to staging are pre-authorized

- **Date:** 2026-08-12
- **Status:** accepted — amended by ADR 0015 (risk tiers): Tier C merges on green without waiting for the staging sign-off; Tier A keeps every checkpoint
- **Decided by:** owner + Claude Code (kickoff)
- **Source:** `CLAUDE.md` "Staging verification (MANDATORY before merging to main)"

## Context

The staging tier (ADR 0004) existed since 2026-07-28 but was optional: a branch could pass the
local pre-commit gate and merge straight to `main`, which deploys to production. The gate
verifies the diff on localhost against the local stack; it never exercises the deployed
artifact, the real build, or the real `lev-yam-staging` Supabase project. The Bluebox kickoff
(same day) made staging a hard dependency for its own verification.

## Decision

Quoted from `CLAUDE.md`:

> **Decided 2026-08-12.** Staging stops being an optional tier and becomes a required stop for
> anything that ships to end users — marketing pages through internal platform modules alike —
> since `main` deploys straight to production and the pre-commit gate only verifies the diff
> locally, never the actual deployed artifact.

> **Applies to:** the same scope as the gate's full multi-agent tier — any diff touching the
> deploy allowlist in `scripts/assemble-site.sh`, `app-src/`, `supabase/`, or
> `.github/workflows/`. **Does not apply to:** diffs with no deployed surface (`docs/`,
> `CLAUDE.md`, `tests/` harnesses) — `assemble-site.sh` never ships them, so staging would be
> identical before and after; there is nothing to verify.

The push itself needs no per-instance approval:

> **Pre-authorized:** do this without asking each time — `staging` never touches production and
> the whole tier is noindexed. If `staging` is already mid-verification for a different branch,
> sequence behind it rather than overwriting.

## Consequences

- Flow for qualifying diffs: feature branch, pre-commit gate, push onto `staging` (merge or
  fast-forward, never force-push), wait for `deploy-staging.yml`, smoke-check, hand the user the
  `staging.levyam.com` click-list, wait for explicit sign-off, then merge to `main`.
- Only `main` and `staging` are long-lived branches; `staging` is kept in sync with `main`.
- The scope reuses the diff-class boundary from ADR 0003, so "full gate" and "needs staging"
  coincide.
- ADR 0015 later relaxed the sign-off wait for Tier C diffs; Tier A keeps every checkpoint.
