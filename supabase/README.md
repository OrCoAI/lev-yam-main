# Supabase

Backend for the Lev Yam platform (`/app`), the survey, and the POS. One Supabase project;
**one Postgres schema per module**, with shared identity & permissions in `core`.

## Schemas

| File | Schema | What |
|---|---|---|
| `schema/00_core.sql` | `core` | Identity & permissions: roles, modules, permissions, RLS helper `core.has_permission()` |
| `schema/10_pos.sql` + `schema/43_pos_cutover.sql` | `pos` | POS tables/RPCs/views (moved from `public` at cut-over, 2026-07-14). |

Module schemas added later (`crm`, `events`, `inventory`, …) follow the same pattern: their
own schema, RLS policies that call `core.has_permission('<module>.<action>')`.

## First-time setup

1. **Apply the schema** — in the Supabase SQL editor, run `schema/00_core.sql`, then
   `schema/10_pos.sql`. Both are idempotent (safe to re-run).
2. **Expose schemas to the API** — Project Settings → API → **Exposed schemas**: add `core`
   (and each new module schema). Without this, the client can't query them.
3. **Create the first user** — Authentication → Users → *Add user* (email + password).
4. **Bootstrap the owner** — run the snippet at the bottom of `00_core.sql` with that email to
   grant the `owner` role. From then on, manage everyone from the in-app **Users & Permissions**
   module.

## Security model

- **RLS is the real guard.** Every table denies by default; policies grant access only via
  `core.has_permission(...)`. The front-end hiding buttons is convenience, not security.
- The **anon / publishable key** shipped in the client is safe to expose — RLS + Auth protect
  the data. (Same policy as the existing survey/POS.)
- The **service-role key is secret** — only ever used inside Supabase **Edge Functions**
  (`functions/`), never in the client bundle, repo, or `.env` that gets committed.

## Permission keys

Format `<module>.<action>` — e.g. `pos.view`, `pos.refund`, `users.manage`. Adding a capability
is an `insert` into `core.permissions` + `core.role_permissions`, not a migration.
