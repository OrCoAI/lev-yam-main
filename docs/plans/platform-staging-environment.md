# Staging environment + migration pipeline

**Status:** kickoff (2026-07-28) — aligned with owner, no code yet
**Branch:** `feat/staging-environment`
**Roadmap home:** Phase 1.5 — Platform hardening (absorbs **H2**, the versioned-migration
pipeline; see [ROADMAP.md](../ROADMAP.md))

## Why

Today `cd app-src && npm run dev` and the pre-commit `/verify` gate both run against the
**live production** Supabase project (`teyxtdccsrkdpqnbfcga`) — the same DB `pos.html` and
`/app` serve. `app-src/.env.local` says so in its own comment. Every local dev run and every
`/verify` reads and writes real customer/POS/finance data. There is no isolated place to test.
As the platform moves into public-facing, community-creating phases (2–6), shipping straight
off "verify locally against prod" is untenable.

## What we're building (owner-locked scope, 2026-07-28)

A three-tier environment, replacing "one project, no staging":

| Tier | Backend | Frontend | Purpose |
|---|---|---|---|
| **Local** | Docker Supabase (`supabase start`, `localhost:54321`) | `localhost:5173/app` | Daily dev — offline, disposable, real RLS/writes |
| **Staging** | Cloud Supabase project `lev-yam-staging` | Cloudflare Pages → `staging.levyam.com` (+ per-PR previews) | Prod-like pre-deploy verification, passkeys, hosted Auth |
| **Prod** | Current project | GitHub Pages → `levyam.com` | Real operations — only ever touched by the real deploy |

Locked decisions:
1. **Both** local Docker stack **and** a cloud staging project (not one or the other).
2. Staging site on **Cloudflare Pages** (free, branch-based, automatic PR previews) →
   `staging.levyam.com`.
3. Staging data is **synthetic seed** only — **no prod data, ever** copied into staging
   (prod holds real customer PII, signed contracts, the owner's signature; ARCHITECTURE §2).
4. **Full cut-over:** default local dev + the `/verify` gate target local/staging; prod is
   only touched by the real deploy. `.env.local` and the CLAUDE.md gate are updated to match.
5. The docs conflict this creates is **resolved by updating the docs** (see below), and
   roadmap item **H2 is folded in** — you cannot keep two projects schema-synced without a
   versioned migration pipeline.

### Out of scope
- Copying any production data into staging (synthetic seed only — hard rule).
- Merging the separate **survey** project into the platform project (tracked consolidation
  debt, ARCHITECTURE §5 — unrelated here).
- Automatic prod→staging data refresh / anonymization pipeline (rejected at kickoff).
- Making `main` deploy anywhere but prod — staging deploys from the `staging` branch / PRs.

## Architecture invariants check (CLAUDE.md kickoff step 3)

Walked the planned work through [ARCHITECTURE.md](../ARCHITECTURE.md) §7:

- **1. RLS on every table; UI gating never the only gate** — unchanged. Staging/local run the
  *same* schema + policies; `rls_matrix.sql` runs against them.
- **2. Anon keys only in browser/repo; service-role only in Edge Functions** — preserved and
  reinforced. Staging's anon key is safe to expose (goes in Cloudflare build env). Staging's
  **service-role key never enters the repo** — it lives only in staging Edge Functions + (if
  needed for CI migration push) a GitHub Actions secret. The local stack's service-role is the
  CLI's well-known local demo key — local-only, not committed.
- **3. No PII/secrets/signatures in the public repo** — preserved. Seed data is synthetic;
  no prod dump is ever committed or pushed to staging.
- **4. Business invariants enforced in Postgres** — unchanged (same schema everywhere).
- **5. HE + AR / RTL** — no UI copy added; staging serves the same bilingual bundle.
- **6. Public-content visibility flag** — unchanged.
- **7. Live tools keep working** — preserved; prod is *more* protected, not less.

**Conflicts found (must be resolved by editing the docs, not coded around — CLAUDE.md
conflict rule):**

- ARCHITECTURE §1 diagram: **"SUPABASE (one project: lev-yam)"** and **"No staging; verify
  locally first."** → rewrite to describe the prod + staging tiers and the local stack.
- ARCHITECTURE §5: "End state: one project, schema-per-module throughout" — the staging
  project is a **deliberate second project**, kept schema-synced via the migration pipeline.
  Reword to state staging is intentional and permanent, distinct from the survey-merge debt.
- ROADMAP "How we work": *"verify locally … there is no staging."* → update.
- CLAUDE.md (Deploying + Pre-commit gate): several **"there is no staging"** / "verify locally
  before pushing" statements → update to reference local stack + staging; `main` → prod stays
  true.

**Resolution (owner-approved 2026-07-28):** update all of the above to describe the staging
tier as the new normal. `main` → production-only is retained.

## Vision check (CLAUDE.md kickoff step 4)

Serves [VISION.md](../VISION.md) Principle **7 (Evolution, not revolution)** — a safe place to
prove changes before they touch live operations is exactly the reliability that principle
demands as the platform absorbs bookings, community initiatives, and public transactions
(Phases 2–6). No conflict with any principle; it's enabling infrastructure for all of them.

## Technical shape

### A. Versioned migration pipeline (absorbs H2)
- Add `supabase/config.toml` (currently absent) — the CLI project config: local ports,
  `[api].schemas = [public, graphql_public, core, finance, quotes, pos]` (mirrors prod's
  exposed list; `events` still withheld until Phase 2).
- Introduce `supabase/migrations/` (timestamped, versioned). Bridge the existing
  `supabase/schema/*.sql`: a **baseline** migration reproduces the documented fresh-install
  order (`00_core → 01_passkeys → 10_pos → 20/21 → 30 → 40 → 42 → 43 → 44 → 45 → 46 → 47 →
  48 → 50`). `schema/*.sql` stays the human-readable source of truth; migrations are the
  applied, ordered, drift-checkable artifact for local + staging (and eventually prod).
  - Note: `10_pos.sql` + `42_pos_platform.sql` are **pre-cut-over** layers safe to run only on
    a *fresh* DB in order (they're followed by `43_pos_cutover.sql`). The baseline runs them in
    order on a fresh local/staging DB — which is correct — but they must **never** be re-run on
    prod (README §First-time-setup gotcha). The pipeline enforces "prod applies new migrations
    only," never a baseline replay.
- **Drift check** in the gate/CI: fresh-DB-from-migrations schema must match prod
  (`supabase db diff` / `pg_dump --schema-only` compare). Extends the existing
  `check-permission-drift.mjs` philosophy from permissions to full schema.

### B. Local Docker stack
- `supabase start` boots Postgres/Auth/PostgREST/Studio at `localhost:54321`.
- `supabase db reset` applies migrations + `supabase/seed.sql` (synthetic data + a local
  owner user bootstrapped for login).
- `.env.local` **default points at the local stack** (local URL + the CLI's local anon key).
- Edge functions run via `supabase functions serve` (passkey-verify, admin-invite,
  admin-user-ops) with the local service-role.
- **Limitation:** WebAuthn passkeys are origin-bound and need a real HTTPS origin — **not
  testable on localhost**; local uses email+password. Passkeys are exercised on
  `staging.levyam.com` instead (a real origin). Documented, not a blocker.

### C. Cloud staging Supabase project
- **Owner provisions** `lev-yam-staging` in the Supabase dashboard (Claude cannot create
  Supabase projects). Capture URL + anon key (→ Cloudflare build env + CI) and service-role
  (→ staging Edge Functions + GitHub secret only; **never the repo**).
- Apply migrations (`supabase link` + `supabase db push`), run the synthetic seed, deploy Edge
  Functions, replicate config: **Exposed schemas**, **Auth redirect URLs** (add
  `https://staging.levyam.com/app/*`), and Auth email (see open question — likely Inbucket/test
  inbox, not Resend, to keep it cheap).

### D. Staging site (Cloudflare Pages)
- **Owner connects** the repo to Cloudflare Pages: `staging` branch → build app-src with
  **staging** `VITE_SUPABASE_*` env vars → assemble the same `_site` bundle → `staging.levyam.com`.
  PR branches get automatic preview URLs.
- Add `staging.levyam.com` DNS (CNAME) — owner, at the DNS provider.
- Staging must be **fully noindex** (robots `Disallow: /` or a noindex header) — it's not a
  public surface.

### E. Full cut-over
- `.env.local` → local stack by default; add `.env.staging.example` for pointing dev/verify at
  cloud staging when a prod-like check is wanted.
- CLAUDE.md `/verify` gate: run the affected flow + `rls_matrix.sql` against **local/staging**,
  never prod. Update the gate + "Deploying" wording.

## Suggested PR breakdown
1. **PR 1 — Migration pipeline + local stack (H2). ✅ DONE (2026-07-28, commit `0cb07a6` on
   `feat/staging-environment`).** `config.toml`, generated baseline migration + `build-baseline.mjs`
   (+ shared `schema-files.mjs`) with drift check in `ci.yml`/`deploy.yml`, `seed.sql` (synthetic
   owner/manager/staff), `.env` restructure to default-local, `supabase start` docs. Runtime is
   **Colima** (Docker-Desktop-free). Fresh-install fix: migration-only bootstrap bypass on the
   last-admin guard (`levyam.bootstrap` + `session_user` denylist), inert at runtime. Full gate
   green; `rls_matrix.sql` extended with both-branch guard-bypass assertions. **This alone gets
   daily dev off prod.** Not yet pushed / no GitHub PR opened.
2. **PR 2 — Cloud staging project. ~DONE (2026-07-28), except edge functions.** Provisioned
   `lev-yam-staging` (ref `vhvghcehkcbtygomixmu`, eu-central-1, free — free-tier slot was
   already open: survey + b2b both already INACTIVE, so no pause/Pro needed after all). Baseline
   + seed applied via the **management-API `database/query` endpoint** (the DB pooler is
   unreachable from this dev box — TCP resets during the Postgres startup handshake; the HTTPS
   management API is the working path). Exposed schemas (`core/finance/quotes/pos`) + staging
   auth `site_url`/redirect allow-list configured. **Verified end-to-end:** owner login + RLS
   finance read via REST, anon denied. DB password saved to gitignored `.secrets/staging-db-password`.
   `.env.staging.example` filled with the real (non-secret) URL + publishable key.
   **DEFERRED:** edge functions (`passkey-verify`, `admin-invite`, `admin-user-ops`) — `functions
   deploy` errors in this sandbox (bundler/upload `Effect.tryPromise`), and passkey needs the
   `staging.levyam.com` origin from PR 3 anyway; deploy them alongside PR 3 with
   `supabase functions deploy <name> --project-ref vhvghcehkcbtygomixmu`. CI secrets for staging
   also pending (PR 3).
3. **PR 3 — Staging site (Cloudflare Pages).** `staging` branch deploy + `staging.levyam.com`
   + PR previews + noindex + DNS (owner).
4. **PR 4 — Docs + gate cut-over + close-out.** Rewrite ARCHITECTURE / ROADMAP / CLAUDE.md /
   supabase README wording; update the pre-commit gate; close-out + alignment verdict.

Each PR runs the full pre-commit gate. PRs 2–3 have **owner prerequisites** (provision the
project / connect Cloudflare / DNS) that block Claude — called out at the top of each.

## Open questions / risks
- **⚠️ Supabase free-tier project cap (owner decision, likely PR 2 prerequisite).** Free plan =
  **2 active projects per org**. The org already runs the platform project **and** the survey
  project — that's the cap. A 3rd (staging) project needs either pausing the survey, a separate
  free org, or **Supabase Pro (~$25/mo)**. The **local stack (PR 1) is free and unaffected** and
  delivers most of the "get off prod" value, so PR 1 can land regardless; the cloud staging tier
  (PR 2/3) waits on this decision. (Relates to the parked PITR paid-tier decision — see the
  20-signed-contracts rule.)
- **Staging Auth email:** Resend on staging (real sender, costs against the plan) vs a local/
  test inbox (Inbucket) — recommend the test inbox to keep staging cheap; passkeys + password
  reset flows still testable.
- **Baseline covers FRESH bootstrap only (deliberate for now).** The single generated baseline
  stands up a *from-scratch* DB (local `db reset`, a brand-new staging project). It does **not**
  provide an incremental path to evolve an *already-provisioned* staging DB while preserving its
  data — that's fine because staging is **disposable / rebuilt from baseline + synthetic seed**.
  The moment staging must survive a schema change with data intact, add post-baseline timestamped
  migrations (PR 2 concern). Stated so the single baseline isn't mistaken for a full
  schema-evolution pipeline.
- **Keeping staging in sync forever:** the drift check guards schema; **data** on staging drifts
  freely (that's fine — it's synthetic). Decide a "reset staging to clean seed" command cadence.
- **Cloudflare as a new external dependency:** first non-GitHub host in the stack. Acceptable
  (still no server of ours), but note it in ARCHITECTURE so the "zero servers" story stays honest.

## Close-out
_(to be written when the initiative completes — what shipped, decisions made, alignment verdict)_
