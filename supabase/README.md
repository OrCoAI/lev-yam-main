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

1. **Apply the schema** — in the Supabase SQL editor, run the `schema/*.sql` files in
   NN order (`00_core` → `01_passkeys` → `10_pos` → `20/21_finance*` → `30_quotes` →
   `40_events` → `42`–`45` POS files → `50_storage`).
   **On the live production DB, never re-run `10_pos.sql` or `42_pos_platform.sql`** —
   they are pre-cut-over layers targeting `public.pos_*`: 42 errors harmlessly, but
   10 would **recreate the retired anon-writable POS surface** in `public` (fresh
   empty tables + anon policies/grants). Post-cut-over, POS policy/seed changes are
   applied via `44_initplan_sweep.sql` / `45_pos_seeds.sql`; every other module file
   is idempotent and safe to re-run anywhere.
2. **Expose schemas to the API** — Project Settings → API → **Exposed schemas**: add `core`
   (and each new module schema). Without this, the client can't query them. Current prod
   list (verified live 2026-07-16): `public, graphql_public, core, finance, quotes, pos` —
   `events` is deliberately NOT exposed until Phase 2 ships the public feed UI.
3. **Configure Auth URLs** — Authentication → URL Configuration: set **Site URL** to
   `https://levyam.com/app` and add **Redirect URLs** `https://levyam.com/app/*`,
   `https://www.levyam.com/app/*`, `http://localhost:5173/app/*`. Without this, invite
   and password-recovery email links get their `redirectTo` rejected and fall back to
   the default Site URL (`http://localhost:3000` — a dead end), consuming the one-time
   token in the process (applied to prod 2026-07-16 via the management API).
4. **Custom SMTP (Resend)** — Auth emails send via `smtp.resend.com` as
   `Lev Yam <info@levyam.com>` (domain verified in Resend; API key lives in
   `.secrets/resend-api-key`, never committed). Configured 2026-07-16 via the
   management API. This also unlocks Auth email-template editing — the free
   tier blocks it on the default mailer — and the invite template is customized
   (bilingual HE/AR). If the Resend key rotates, re-apply `smtp_pass` via
   Authentication → Emails → SMTP Settings or the management API.
   **Gotcha:** configuring custom SMTP does NOT auto-raise the Auth email rate
   limit — `rate_limit_email_sent` stays at the built-in default of **2/hour**,
   so real invite usage fails with `over_email_send_rate_limit` (surfaced in-app
   as the generic "invite failed / שליחת ההזמנה נכשלה"). Raise it once Resend is
   the sender (set to **30** on 2026-07-16 via the management API `config/auth`).
5. **Create the first user** — Authentication → Users → *Add user* (email + password).
6. **Bootstrap the owner** — run the snippet at the bottom of `00_core.sql` with that email to
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
