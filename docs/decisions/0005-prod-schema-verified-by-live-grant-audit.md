# 0005 — Prod schema state is verified by a live grant audit on every deploy, never assumed; prod joins the migration pipeline only behind named prerequisites

- **Date:** 2026-08-05 (amended 2026-08-12)
- **Status:** accepted
- **Decided by:** owner + Claude Code (review / kickoff)
- **Source:** `docs/ROADMAP.md` "PROD privilege escalation closed (2026-08-05)" block and its two sub-items; `docs/plans/phase1-closeout.md` §D and locked-scope table

## Context

On 2026-08-05 the gate found a live privilege escalation on prod: `core.admin_assign_role()` was
executable by `authenticated`, so any signed-up user could grant themselves owner. Root cause:

> **Root cause is process:** prod is not on the migration pipeline and each PR only
> hand-applied the *new* objects it added, so a `grant`/`revoke`/`alter` added later against
> an existing object never ran there

"Committed schema = live state" had now failed twice (the `post_day` revenue wipe and this
drift), and the roadmap pointed at a grant audit as already existing; it did not.

## Decision

1. Prod's live grant state is verified by a committed, re-runnable audit on every deploy
   (decided 2026-08-05, delivered 2026-08-12):

> **A live grant audit exists and runs every deploy** *(2026-08-12)* — `supabase/tests/audit-grants.mjs`
> replays every CREATE/GRANT/REVOKE/DROP/ALTER-SET-SCHEMA from `schema/*.sql` **in order** and
> compares the result against the live catalog. Wired into `deploy.yml` (gating) and
> `deploy-staging.yml` (advisory).

2. Amendment 2026-08-12: putting prod on the migration pipeline is deferred, with its
   prerequisites named, because the obvious move is destructive:

> prod has never been linked, so its migration ledger is empty and `supabase db push` would
> **replay the entire baseline**, which re-creates the anon-writable POS surface the
> 2026-07-14 cut-over closed and re-seeds POS permissions over live rows. Required first, in
> order: (1) a real schema diff proving prod matches the baseline, (2) `supabase migration
> repair --status applied` to stamp it **without executing it**, (3) connectivity from CI —
> the dev box cannot reach the DB pooler. Until then §D's audit is the check that actually runs

The close-out's scope table records the owner's call as "**Commit the audit script, defer the
pipeline.**" and drops running `rls_matrix` against prod (destructive DML).

## Consequences

- Its first real run found a live TRUNCATE hole on all four `pos.pos_*` tables (TRUNCATE is
  not governed by RLS) plus 15 anon-callable functions; all closed on both tiers.
- The pipeline item stays open with its three prerequisites; nobody runs `supabase db push`
  against prod until they are met.
- `SUPABASE_ACCESS_TOKEN` is a repo secret (2026-08-26), audit detail is withheld from public
  logs, and any later grant/revoke/alter on an existing object is caught at deploy, not trusted.
