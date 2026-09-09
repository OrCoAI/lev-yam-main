# 0004 — lev-yam-staging is a deliberate, permanent second Supabase project; dev and the verify gate never run against prod

- **Date:** 2026-07-28
- **Status:** accepted
- **Decided by:** owner + Claude Code (kickoff / close-out)
- **Source:** `docs/plans/platform-staging-environment.md` (locked scope + close-out); `docs/ARCHITECTURE.md` §5 "Known consolidation debt" note; `docs/ROADMAP.md` "Staging environment" entry

## Context

Until 2026-07-28 the platform had one Supabase project and no staging: local dev, the `/verify`
gate and `rls_matrix.sql` all ran against production, which holds real customer PII, signed
contracts and the owner's signature. `docs/ARCHITECTURE.md` §5 stated an end state of "one
project, schema-per-module throughout", which a second project would appear to contradict.

## Decision

A three-tier environment replaces "one project, no staging". The locked decisions from the plan:

> 1. **Both** local Docker stack **and** a cloud staging project (not one or the other).
> 2. Staging site on **Cloudflare Pages** (free, branch-based, automatic PR previews) →
>    `staging.levyam.com`.
> 3. Staging data is **synthetic seed** only — **no prod data, ever** copied into staging
>    (prod holds real customer PII, signed contracts, the owner's signature; ARCHITECTURE §2).
> 4. **Full cut-over:** default local dev + the `/verify` gate target local/staging; prod is
>    only touched by the real deploy.
> 5. The docs conflict this creates is **resolved by updating the docs** (see below), and
>    roadmap item **H2 is folded in** — you cannot keep two projects schema-synced without a
>    versioned migration pipeline.

The architecture note that resolves the apparent conflict with the consolidation end state:

> Note: `lev-yam-staging` is a **deliberate, permanent second project** (2026-07-28) — a prod
> mirror for pre-deploy testing, kept schema-synced via the migration pipeline — and is
> distinct from this survey-merge debt.

## Consequences

- Local dev runs on a Colima/Docker Supabase stack; cloud `lev-yam-staging` plus
  `staging.levyam.com` serve as the prod-like tier; prod is touched only by the real deploy.
- The versioned migration pipeline (baseline from `schema/*.sql`, drift check in CI) exists
  because of this decision; it absorbed roadmap H2.
- Synthetic seed only in staging is a hard rule; a prod-to-staging refresh pipeline was rejected.
- The "one project" wording in ARCHITECTURE / ROADMAP / CLAUDE.md was rewritten per the conflict
  rule rather than coded around. Staging verification later became mandatory (ADR 0012).
