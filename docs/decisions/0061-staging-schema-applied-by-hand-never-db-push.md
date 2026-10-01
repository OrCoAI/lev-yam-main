# 0061 — Staging's schema is applied by hand like prod's; `supabase db push` is never run against either tier while neither records a migration history

- **Date:** 2026-09-30
- **Status:** accepted. Amends [0004](0004-staging-is-a-permanent-second-supabase-project.md), which said staging is "kept schema-synced via the migration pipeline"; applies [0005](0005-prod-schema-verified-by-live-grant-audit.md)'s rule (by hand + the live grant audit) to staging, and corrects CLAUDE.md's "Schemas" line, which said `supabase db push` for staging. 0005's route onto the pipeline (a schema diff, `supabase migration repair --status applied`, connectivity from CI) stays open for both tiers.
- **Decided by:** owner, 2026-09-30 (chose "change CLAUDE.md" over putting staging on the migration pipeline).
- **Source:** the "What's happening" plan's staging apply step (2026-09-29) and the owner's question about the conflict it left with CLAUDE.md.

## Context

CLAUDE.md told the agent to follow every schema change with `supabase db push` on staging. In
practice staging has always been changed by hand, exactly like prod: neither project has a
`supabase_migrations.schema_migrations` table (checked 2026-09-30), because both were built and
updated through the SQL editor and the management API, never by the CLI's migration runner. A push
therefore sees the one migration file — the baseline, every schema file concatenated — as never
applied and replays it onto a live database. The baseline includes `10_pos.sql`, which on a live
database recreates the retired anon-writable POS surface in `public` (supabase/README.md, "First-time
setup"). At best the push stops on an error and changes nothing; at worst it reopens that surface.
The CLI cannot reach the tier databases from the dev machine either (`db query --linked` fails with
`LegacyDbConfigConnectTempRoleError`), so the documented command was never the one actually used.

## Decision

1. **Staging and prod are applied the same way:** each new or changed schema file, in order, as one
   management-API call (`POST /v1/projects/<ref>/database/query` — one transaction), then
   `notify pgrst, 'reload schema'`, then the grant audit (`audit-grants.mjs --ref`). Staging before
   the staging round; prod before the merge when the new code depends on the change.
2. **`supabase db push` is never run against staging or prod while neither records a migration
   history.** The only way out is ADR 0005's prerequisite path — prove the tier matches the
   baseline, stamp the baseline applied with `supabase migration repair --status applied` (without
   executing it), and reach the database from CI — recorded in its own ADR before any push. It
   stays in `.claude/settings.json`'s `ask` list as a guardrail against habit.
3. **`10_pos.sql` and `42_pos_platform.sql` are never re-run on a live tier**, even after an edit —
   they are the pre-cut-over POS layers; a POS change goes in a new file. A changed file that seeds
   `core.role_permissions` (`on conflict do nothing`) re-grants rows the owner removed in the app:
   check before applying it.
4. The grant audit sees surplus privileges only — not a data change on an existing row (a label, a
   seed), an RLS policy, a column grant or a file that never ran — so each such change is checked
   with its own `select` after it is applied. On staging the deploy's audit is advisory; the manual
   `audit-grants.mjs --ref` run is the check. Prod is applied after the staging sign-off, with the
   owner's go-ahead.
5. The commands live in [supabase/README.md](../../supabase/README.md) "Applying a schema change";
   CLAUDE.md's "Schemas" line points there.

## Consequences

- One path for both remote tiers; the plan files stop prescribing `supabase db query --linked`.
- ARCHITECTURE §5, the ROADMAP intro and H2's scope note, `supabase/README.md`,
  `docs/MODULE-TEMPLATE.md` and `build-baseline.mjs` are corrected to match (they described staging
  as on the pipeline, or applying a module file "in the SQL editor").
- Putting staging on the migration pipeline (marking the baseline applied, then writing every later
  change as its own migration file) was considered and not taken: it changes how every schema change
  is written and still would not run from the dev machine.
