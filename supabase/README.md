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

## Applying a schema change

`schema/*.sql` is the source of truth; the tiers get it three different ways
([ADR 0061](../docs/decisions/0061-staging-schema-applied-by-hand-never-db-push.md)):

- **Local:** `node supabase/tests/build-baseline.mjs --write`, then `supabase db reset`.
- **Staging, then prod — by hand, never `supabase db push`.** Neither project records a migration
  history (`supabase_migrations.schema_migrations` does not exist there), so a push would replay the
  whole baseline — including `10_pos.sql`, which on a live database recreates the retired
  anon-writable POS surface (see "First-time setup" below). Apply only the new or changed files, in
  order, each as one management-API call (one transaction — a file that drops and re-adds a CHECK can
  never be left half-applied). **Never re-run `10_pos.sql` or `42_pos_platform.sql` on a live tier,
  even after an edit** (a POS change goes in a new file), and check a changed file that seeds
  `core.role_permissions` first — its `on conflict do nothing` re-grants rows removed in the app.

  Run it in **bash** (`bash`, then paste) — interactive zsh does not treat `#` as a comment
  unless `setopt interactivecomments`. The token comes from the keychain (the CLI's login token,
  macOS) or `read -rs TOKEN`, so it is never typed into the shell or committed. `REF` is
  `vhvghcehkcbtygomixmu` (staging) or `teyxtdccsrkdpqnbfcga` (prod). The chain stops at the first
  failure; a successful apply prints `[]`, and the audit should end with `0 drift`.

  ```bash
  TOKEN=$(security find-generic-password -s "Supabase CLI" -w)
  REF=vhvghcehkcbtygomixmu
  q() { curl -sS --fail-with-body -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
          -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary "$1"; local rc=$?; echo; return $rc; }
  q "$(jq -Rs '{query: .}' supabase/schema/NN_name.sql)" &&
  q '{"query": "notify pgrst, '"'"'reload schema'"'"'"}' &&
  SUPABASE_ACCESS_TOKEN=$TOKEN node supabase/tests/audit-grants.mjs --ref $REF
  ```

  Staging before the staging round; prod after the staging sign-off, with the owner's go-ahead —
  before the merge whenever the new code depends on the change (otherwise at the merge). The API
  does not return `raise notice` output — run any pre-check a file's header asks for as its own
  query first. **The grant audit sees surplus privileges only** — not a data change on an existing
  row (a label, a seed), an RLS policy, a column grant, or a file that never ran — so probe each
  such change with its own `select` (e.g. `pg_policies`, `information_schema.column_privileges`,
  the row itself). On staging the deploy's audit is advisory; the manual run above is the check.
  Never `psql -f` against a tier — it autocommits statement by statement (locally, `psql -1 -f`).

## Local development (Docker stack)

Daily dev runs against a **local** Supabase stack — not production. (Full initiative:
[docs/plans/platform-staging-environment.md](../docs/plans/platform-staging-environment.md).)
Requires Docker running. From the repo root:

```bash
supabase start        # boots Postgres/Auth/PostgREST/Studio at 127.0.0.1:54321 (Studio :54323)
supabase db reset     # applies migrations/ then seed.sql — synthetic users + data, fresh each time
supabase status       # prints the API URL + anon key if you need to confirm them
```

Then `cp app-src/.env.example app-src/.env.local` (already points at the local stack) and
`cd app-src && npm run dev` → `localhost:5173/app`. Seeded logins (dev-only passwords, in
`seed.sql`):

| Email | Password | Role |
|---|---|---|
| `owner@levyam.local` | `levyamdev` | owner |
| `manager@levyam.local` | `levyamdev` | manager |
| `staff@levyam.local` | `levyamdev` | staff |

- **`supabase db reset` is destructive to the *local* DB only** — it drops and rebuilds it
  from `migrations/` + `seed.sql`. It never touches prod (that needs an explicit `--linked`,
  which we don't run).
- **Passkeys can't be enrolled on localhost** (WebAuthn is origin-bound) — use email+password
  locally; passkeys are exercised on `staging.levyam.com` (PR 3).
- **Migrations vs. `schema/`.** `schema/*.sql` stays the source of truth. The CLI applies
  `migrations/20260728120000_baseline.sql`, which is those files concatenated in fresh-install
  order. **After editing any `schema/*.sql`, regenerate the baseline:**
  `node supabase/tests/build-baseline.mjs --write` (CI fails otherwise — the `--check` runs in
  `ci.yml` + `deploy.yml`). Changes after the baseline are new or edited `schema/*.sql` files,
  applied by hand on staging and prod ("Applying a schema change" above); `migrations/` holds
  only the baseline.
- Edge functions: `supabase functions serve` (uses the local service-role key — local-only,
  never committed).

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
   list (verified live 2026-07-16): `public, graphql_public, core, finance, quotes, pos`.
   **`events` is added with `58_events_public.sql`** (the public "What's happening" feed,
   2026-09): apply 58 first, then expose — never the other way round, or staff can read
   quote-projected customer names before 58's select policy lands.
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
5. **Email confirmation is ON, deliberately** — prod runs with `mailer_autoconfirm: false`
   (verified live 2026-07-30), so **an account whose `email_confirmed_at` is null cannot
   sign in at all**: GoTrue answers every password grant with `email_not_confirmed`, no
   matter how correct the password is. This is the single most confusing failure mode in
   the platform, because the address is normally confirmed as a side effect of opening the
   invite link — so an invitee whose link expired, went to spam, or was never opened ends
   up with a working password and no way in. **Note the local stack does the opposite:**
   `config.toml` sets `enable_confirmations = false`, so local/`db reset` users are
   auto-confirmed and this state never occurs by itself. To reproduce it locally:
   `update auth.users set email_confirmed_at = null where email = '…';`
   The in-app remedy is the users module's **אימות אימייל / تأكيد الإيميل** action
   (`admin-user-ops` `confirm_email`, owner-only via `users.password`) — and setting a
   password from the console also confirms the address when it isn't confirmed yet.
   Out-of-band remedy (no app needed), e.g. if the owner is locked out:
   ```
   curl -X PUT "https://<ref>.supabase.co/auth/v1/admin/users/<user_id>" \
     -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
     -H "Content-Type: application/json" -d '{"email_confirm":true}'
   ```
   **Never send `email_confirm: true` unconditionally** to an already-confirmed user:
   GoTrue re-stamps `email_confirmed_at` with `now()` (it is *not* idempotent — measured
   2026-07-30), destroying the record of when the account was really verified. The edge
   function guards this with `confirmIfNeeded()`.
   **Self-signup is currently open** on prod (`disable_signup: false`) even though the
   platform is invite-only and ships no signup UI. A stranger can therefore create an
   unconfirmed, role-less account (harmless on its own — RLS denies everything without a
   role). Recommended: turn it off, so `confirm_email` can never unlock a password the
   platform never verified anyone controls. See `docs/modules/users.md`.
6. **Create the first user** — Authentication → Users → *Add user* (email + password).
7. **Bootstrap the owner** — run the snippet at the bottom of `00_core.sql` with that email to
   grant the `owner` role. From then on, manage everyone from the in-app **Users & Permissions**
   module.

## Security model

- **RLS is the real guard.** Every table denies by default; policies grant access only via
  `core.has_permission(...)`. The front-end hiding buttons is convenience, not security.
- The **anon / publishable key** shipped in the client is safe to expose — RLS + Auth protect
  the data. (Same policy as the existing survey/POS.)
- The **service-role key is secret** — only ever used inside Supabase **Edge Functions**
  (`functions/`), never in the client bundle, repo, or `.env` that gets committed.

## The site rebuild (`rebuild-site`)

The public "What's happening" landing pages are static HTML generated at deploy
from `events.feed` ([ADR 0056](../docs/decisions/0056-whats-happening-item-pages-are-generated-landing-pages-rebuilt-on-publish.md)).
Publishing, unpublishing or editing a public item in `/app/events` calls the
`rebuild-site` Edge Function, which re-checks `events.manage` and dispatches the
tier's deploy workflow through GitHub's API. Three secrets per project, set
**one at a time** (`--env-file` uploads every variable in the file):

| Secret | Staging | Prod |
|---|---|---|
| `GITHUB_DISPATCH_TOKEN` | a fine-grained PAT: resource owner `OrCoAI`, **only** `lev-yam-main`, repository permission **Actions: Read and write**, nothing else, **1-year expiry** — note the date; when it lapses the function answers `dispatch_failed`, the form says so, and the nightly rebuild still runs | the same token (or its own) |
| `REBUILD_WORKFLOW` | `deploy-staging.yml` | `deploy.yml` |
| `REBUILD_REF` | `staging` | `main` |

```bash
supabase secrets set --project-ref <ref> GITHUB_DISPATCH_TOKEN=<token>
supabase secrets set --project-ref <ref> REBUILD_WORKFLOW=deploy-staging.yml
supabase secrets set --project-ref <ref> REBUILD_REF=staging
supabase functions deploy rebuild-site --no-verify-jwt --use-api --project-ref <ref>
```

Without the token the function answers `not_configured` (the local stack); a token with a
workflow or ref outside `deploy.yml|deploy-staging.yml` / `main|staging` answers
`misconfigured` (the form says the rebuild failed). If the first real publish answers
`dispatch_failed`, GitHub refused the dispatch (403/404): re-check the token's repository
and expiry, and grant it **Contents: Read** as well — some accounts need it for the
dispatch endpoint. Honest scope of the token: it can dispatch, re-run, cancel or delete runs of any of this
repo's `workflow_dispatch` workflows on any ref; it cannot push code, read secrets
or change settings. The `github.ref` job guards on both deploy workflows and the
`github-pages` environment's `main`-only branch policy are what keep a dispatch
from publishing anything but the tier's own branch.

## Edge Function telemetry (Bluebox / OpenTelemetry)

The Edge Functions emit OpenTelemetry **traces + sanitized logs** to the Bluebox
environment (roadmap **H8**; design in
[docs/plans/bluebox-observability.md](../docs/plans/bluebox-observability.md), helper in
`functions/_shared/otel.ts`).

**It is off unless configured.** With no telemetry secrets set, the OTel packages are never
even imported and the functions behave exactly as they did before H8 — so a fresh project,
a local stack, or a rolled-back token all degrade to "no telemetry", never to an error.

| Secret | Purpose |
|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Bluebox OTLP base URL (SDK appends `/v1/traces`, `/v1/logs`) |
| `OTEL_EXPORTER_OTLP_HEADERS` | `Authorization=Api-Token <token>` — **secret**, same class as the service-role key |
| `OTEL_ENVIRONMENT` | `staging` / `prod` — becomes `deployment.environment` |
| `OTEL_VCS_REVISION` | Commit SHA the deploy was built from; omitted from spans if unset |

Set them per project — never in a committed file (the repo is public):

```bash
supabase secrets set --project-ref <ref> \
  OTEL_EXPORTER_OTLP_ENDPOINT='https://<env>.live.dynatrace.com/api/v2/otlp' \
  OTEL_EXPORTER_OTLP_HEADERS='Authorization=Api-Token <token>' \
  OTEL_ENVIRONMENT='staging' \
  OTEL_VCS_REVISION="$(git rev-parse HEAD)"
```

For local work, put the same keys in `supabase/functions/.env` (git-ignored) and pass
`--env-file supabase/functions/.env` to `supabase functions serve`.

**What a span may carry is an allow-list, not a deny-list** — action, step, permission key,
outcome, error *class* and a charset-restricted error *code*, duration, HTTP method/status.
Never an email, password, token, WebAuthn credential, or any error message text (an invite error
message embeds the invitee's address). The allow-list is enforced in the wrapper, not by call-site
discipline: `report()` accepts a fixed field type, and `sanitize()` gates every value — including
the span name — on a charset that excludes `@`, whitespace and quotes. Extending it is a
deliberate decision — see architecture invariant 3.

**Reading the spans — two things that will mislead you if you don't know them:**

- **`levyam.action` is what was *attempted*, not what was authorized.** It is reported before the
  caller is authenticated, so an unauthenticated request can produce a span labelled
  `admin-user-ops delete` / `users.delete`. That's deliberate — an attempted privileged action is
  worth seeing — but **any alert or dashboard filtering on `levyam.action` must also filter
  `levyam.outcome`**, or a burst of rejected probes reads as real delete traffic.
- **Requests rejected before the wrapper are not traced at all** (bad `Origin`, wrong method).
  Absence of a span is not absence of traffic; Supabase's own request logs have those.

## Permission keys

Format `<module>.<action>` — e.g. `pos.view`, `pos.refund`, `users.manage`. Adding a capability
is an `insert` into `core.permissions` + `core.role_permissions`, not a migration.
