# CLAUDE.md

Guidance for Claude Code (and humans) working in this repo.

## What this is

**לב ים / Lev Yam** — a social-business venue in the Jisr az-Zarqa fishing village. The repo
holds two things deployed together to **levyam.com** via **GitHub Pages**:

1. A **static marketing site** + standalone tools (no build step, no npm) — the original site.
2. A **modular internal platform** under `/app` — a Vite + React + TypeScript app behind a
   login, with a role→module→action permission system. This is where new internal modules go.

| Surface | Path | Purpose | Build | Backend |
|---|---|---|---|---|
| Marketing | `index.html` | Public marketing & booking (HE/AR) | none (static) | none |
| Survey | `survey-june.html` | Community survey | none (static) | Supabase |
| POS | `pos.html` | Internal staff POS / billing (live) | none (static) | Supabase |
| **Platform** | `/app` → `app-src/` | Internal staff platform (login + modules) | **Vite + React + TS** | Supabase |

`pos.html` and `survey-june.html` stay standalone **until migrated into platform modules** —
don't break them. See [README.md](README.md) and [supabase/README.md](supabase/README.md).

The **quotes & contracts manager** is a separate *local* app at `~/lev-yam-quotes` (Python
API server + React dashboard + real customer data and the owner's signature). **Never copy
it into this repo** — everything here deploys publicly to GitHub Pages. It is the **first**
planned module migration, ahead of POS (see the roadmap and `docs/plans/quotes-module.md`).

**Where this is going:** the long-term product vision lives in [docs/VISION.md](docs/VISION.md),
the phased task plan in [docs/ROADMAP.md](docs/ROADMAP.md), and the architecture overview
(security model, RBAC, mobile-first, scalability) in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
When starting platform work, read the roadmap first and pick up the current phase; when
finishing, tick completed tasks and add discovered ones.

## Conventions & gotchas

### Marketing site (`index.html`, `survey-june.html`, `pos.html`)
- **No build tooling.** Edit HTML/CSS/JS directly. Test by serving the folder:
  `python3 -m http.server 8080`.
- **Bilingual (HE default + Levantine Arabic, RTL).** The marketing i18n dictionary lives in
  `js/app.js`. When you add/change user-facing copy on `index.html`, update **both** languages
  and the `data-i18n` keys — don't hardcode a single language.
- **Fonts are self-hosted** woff2 subsets in `fonts/` (Heebo + Assistant, HE/Latin splits). No
  external font CDN calls — keep it that way.
- **Analytics — three vendors, deliberately unequal scopes.** A WhatsApp CTA click fans out to all
  three through `js/wa-track.js` (`LevYamTrack.whatsappClick`), the one file shared by the homepage
  (`js/app.js`) and every `/stories/` page (`js/stories.js`): Dynatrace `levyam.whatsapp_cta`, Meta
  Pixel `Contact`, and **GA4 `whatsapp_click`** carrying `page_slug` (`home`, `story-hub`, or the
  story slug — from `<body data-page-slug>`). Everything else — service interest, contact intent,
  FAQ opens, language switches — is homepage-only and goes to **Dynatrace alone**, intentionally
  not to Meta or GA4. Each sender no-ops when its vendor script hasn't loaded.
  **GA4** is `G-VWL45MKK76` (added 2026-08-11). Its **Enhanced Measurement** stays ON, so `page_view`,
  `scroll` and an automatic outbound `click` on the same `wa.me` links arrive without repo code;
  `whatsapp_click` sits next to that as the named, per-page event and is the one marked as a key
  event in the GA4 UI. *(This reverses the original "GA4 carries no hand-written events" decision —
  reversed deliberately 2026-08-11 with the `/stories/` build, because per-page CTA attribution is
  what the story pages are measured by. Adding any **further** `gtag('event', …)` is still a
  deliberate decision, not a default.)*
  **Tier separation for GA is console-side, not code-side:** `staging.levyam.com` serves this exact
  `index.html` with the same measurement ID, so staging is excluded via an internal-traffic/hostname
  filter in GA → Admin. Don't "fix" that with a hostname guard in the snippet — a domain change
  would silently kill prod collection.
- **Contact details** must stay consistent everywhere: WhatsApp `972506669138`,
  email `info@levyam.com`. There are ~12 WhatsApp CTAs on the marketing page.

### Stories section (`stories/`, served at `/stories/`)

Answer-first content pages, one per query cluster. Plan:
[docs/plans/content-engine-phase0.md](docs/plans/content-engine-phase0.md).

- **A page is a pair.** `stories/<slug>/index.html` (Hebrew) **and** `stories/ar/<slug>/index.html`
  (Arabic), same English kebab-case slug, cross-linked with reciprocal `hreflang`. Neither ships
  alone — that's `docs/ARCHITECTURE.md` invariant 5. Copy `stories/_template.html` and
  `stories/_template.ar.html`; underscore-prefixed files are never served or scanned.
- **`FACTS.md` (served as `/facts.txt`) is the only fact source**, together with what's already on
  levyam.com. Anything else → `[חסר: ...]` / `[مفقود: ...]`, never invented. A quote attributed to a
  real person is verified with them first. **No prices anywhere in the repo, in any file** — inquiry
  by WhatsApp only.
- **Story pages load `js/stories.js`, never `js/app.js`.** `app.js` is homepage-only behaviour built
  around a client-side language swap (one URL, either language); story pages use the opposite
  model — one URL per language, paired by `hreflang`. (It would also erase their SEO metadata:
  `applyTranslations` rewrites `document.title` and the description/og meta unconditionally.)
  Asset paths are root-absolute (`/css/…`) because the Arabic tree sits a directory deeper.
- **`sitemap.xml` and both hubs are generated**, not hand-edited: `node scripts/gen-stories-index.mjs`
  (edit `stories/_hub.html` / `_hub.ar.html`, never `stories/index.html`). The deploy runs it before
  assembly so production is always right; `ci.yml` runs `--check` so a stale committed copy fails
  the branch. The generator also **enforces the twin rule** — a page missing its other language
  fails the build. A page carrying `<meta name="robots" content="noindex">` — like the `dugma`
  sample — is excluded from the sitemap and the hub, and logged as skipped.

### Platform (`app-src/`, served at `/app`)
- **Stack:** Vite + React 18 + TypeScript + react-router. Dev points at the **local Supabase
  stack** (Colima/Docker): `supabase start && supabase db reset` first, then
  `cd app-src && npm run dev` (runs at `localhost:5173/app`; seed logins in `supabase/seed.sql`).
  Build/typecheck: `npm run build`. Local dev never touches prod — see
  [supabase/README.md](supabase/README.md) and the staging plan.
- **Vite `base` is `/app/`** and the router `basename` is `/app` — keep them in sync if the
  hosting path ever changes.
- **Permissions are role → module → action.** The DB enforces them via RLS calling
  `core.has_permission('<module>.<action>')`; the UI mirror (`lib/permissions.ts`,
  `RequirePermission`, `useCan`) is convenience only. Never rely on UI gating alone.
- **One Supabase client** (`lib/supabase.ts`); query a module's schema with
  `supabase.schema('<module>')`. Permission keys are constants in `lib/permissions.ts`.
- **A new module** = a Postgres schema + RLS in `supabase/schema/`, a row in `core.modules`,
  permission rows in `core.permissions`/`core.role_permissions`, a folder in `src/modules/`,
  a route in `App.tsx`, and a launcher destination in `shell/Launcher.tsx`. The full
  checklist (+ hard-won gotchas) is [docs/MODULE-TEMPLATE.md](docs/MODULE-TEMPLATE.md) —
  follow it and keep it updated.
- **Bilingual & mobile-first are platform requirements** (decided 2026-07: from Phase 1 on).
  Platform UI ships in Hebrew + Levantine Arabic through the shell i18n layer — never
  hardcode one language — and is designed and tested phone-first (staff and members work
  from phones). The full "invariants that must never break" list is in
  `docs/ARCHITECTURE.md`.

### Both
- **`pos.html` and `/app` are internal.** Both are excluded from crawlers in `robots.txt`.
  Don't link to them from public pages (except the discreet footer "Staff login" → `/app`) or
  add them to `sitemap.xml`.
- **Supabase keys** shipped to the browser (`js/survey.js`, `pos.html`, and the platform's
  `VITE_SUPABASE_ANON_KEY`) are the **anon/publishable** keys — safe to commit/expose. RLS +
  Auth are the guard. **Never** add a service-role/secret key to any committed file or `.env`;
  service-role lives only in Supabase Edge Functions (`supabase/functions/`).
- **Database schemas** live in `supabase/schema/` — `00_core.sql` (identity & permissions) is
  the source of truth for the `core` schema; `10_pos.sql` for the live POS. Change the model
  there, then **regenerate the baseline migration** the local/staging stacks apply:
  `node supabase/tests/build-baseline.mjs --write` (CI's drift check fails if you forget), and
  commit it. Apply the change with `supabase db reset` (local) / `supabase db push` (staging),
  or re-run the file in the Supabase SQL editor (prod, until prod joins the pipeline). Add new
  module schemas in the same folder. Full local/staging workflow: [supabase/README.md](supabase/README.md).

## Module work kickoff (MANDATORY)

**Step zero — alignment questions.** Before starting any new roadmap item, go over it with
the user question-by-question (scope, expected outcome, what's explicitly out of scope, how
it serves `docs/VISION.md` and fits `docs/ARCHITECTURE.md`) until both sides are **100%
aligned** on what is about to be built. No kickoff artifacts and no code until that
agreement is explicit.

Then, when the user asks to work on a **new initiative** for a module — a migration, a new
cross-module flow, a new UI surface, anything with real scope — **before writing any
code**, generate the full tracking & alignment set — all of it, in parallel:

1. **Plan file** — `docs/plans/<module>-<initiative>.md` (one per initiative): scope, the
   schema / RLS / permission changes, UI surface, and open questions. Link it from
   `docs/ROADMAP.md`.
2. **Roadmap alignment** — confirm the work belongs to the current phase in
   `docs/ROADMAP.md`; add the task there if it's missing, or flag it if it jumps phases.
3. **Architecture invariants check** — walk the planned work through `docs/ARCHITECTURE.md`:
   permissions DB-first (RLS via `core.has_permission`, UI mirror second), schema changes in
   `supabase/schema/` as source of truth, money/lifecycle flowing through the cross-module
   spine (no module-local silos), bilingual HE/AR via shell i18n, mobile-first.
4. **Vision check** — confirm the work serves the direction in `docs/VISION.md`.
5. **Branch** — create a working branch (`main` deploys straight to production); merge via
   PR after the pre-commit gate below passes.

**Conflict rule:** if any part of the requested work contradicts the vision, roadmap, or
architecture — or those docs contradict each other — **stop and raise it with the user
explicitly**. Never code around a conflict or silently pick a side. Work proceeds only after
the disagreement is discussed and resolved together, and the agreed resolution is written
back into the relevant doc so it can't resurface.

## Ongoing module work — bug fixes & small features

Not every change to a live module is a new initiative. For a **bug fix or small,
self-contained feature** on a module that's already shipped, skip the kickoff above and
use the lighter log instead — automatically, the moment the user says they want to work on
an existing module, without waiting to be asked:

1. Check `docs/modules/<module>.md` for existing open items before starting, and surface
   what's already logged there to the user — avoids duplicate or conflicting fixes.
2. Log the item there under **Open bugs** or **Open feature ideas** if it isn't already —
   one line: what's wrong/wanted, and why if the reason isn't obvious.
3. Do the work, then move the entry to **Done** with the date and a one-line note of what
   changed — as part of finishing the task, not a separate step the user has to request.
4. Before running the pre-commit gate, give the user a plain list of every fix/change made
   this session to confirm by hand, plus the local environment to test them in: the exact
   command(s) to run (e.g. `python3 -m http.server 8080` for static pages/`pos.html`, `cd
   app-src && npm run dev` for the platform) and, per item, what to open/click to see it
   working. Wait for the user's confirmation before moving on to the gate. (This is the
   same localhost-confirmation contract as the gate's step zero below, which also covers
   initiative work — screenshots first, then the user's sign-off.)
5. The pre-commit quality gate below still applies in full — it is never optional, kickoff
   or no kickoff.

If the fix turns out bigger than expected once you're in it — new schema, new permissions,
touches the events/finance spine, a UI surface with real design decisions — stop and run
the full kickoff process above instead; it has grown into an initiative. See
`docs/modules/README.md` for the convention.

## Pre-commit quality gate (MANDATORY)

**Step zero — UI confirmed on localhost before the gate starts (decided 2026-08-11).**
For any diff with user-visible UI changes — marketing site, `/stories/`, or the platform —
the gate does not begin until the change is confirmed on localhost, in this order:

1. Claude verifies the change visually first with headless-Chrome screenshots at both
   viewports (360px narrow + 390px mobile + 1280px desktop; see the screenshot workflow
   notes). The helper also reports horizontal overflow per viewport — a
   `!! HORIZONTAL OVERFLOW` line is a finding, not noise. 360px joined the default set on
   2026-08-12: the topbar overflowed there for five weeks while every gate screenshot passed
   clean, because 390 is *exactly* the width it fit at.
2. Claude gives the user the exact serve command (`python3 -m http.server 8080` for
   static pages, `cd app-src && npm run dev` for the platform) and, per change, what to
   open/click to see it working.
3. The user confirms it looks right. **Only then does the gate below run.**

Rationale: the gate is several high-effort passes; a UI change rejected after the
gate means running the whole gate twice. This generalizes step 4 of the lighter bug-fix
flow above to every UI diff, initiatives included. Diffs with no user-visible UI surface
skip step zero and go straight to the gate.

**No commit happens until all of these pass**, on the pending diff. Run each review skill at
**high effort** (`high`) using the most capable Claude model available — never a lighter
model or a lower effort level to save time. Fix every finding (or get the user's explicit
sign-off to skip one) and re-run the step until it comes back clean:

1. **`/simplify`** — reuse/simplification/efficiency cleanups on the changed code. Runs
   first and alone: it applies fixes directly to the working tree, so steps 2–3 must review
   the diff it produces, not the one before it.
2. **`/code-review high`** + **`/security-review`** — run **concurrently** (decided
   2026-08-12): both are read-only findings-passes over the same post-simplify diff with no
   dependency on each other, so serializing them only cost time. Collect findings from both
   before fixing anything; if a fix for one touches code the other already cleared, re-run
   that one too. All findings from both resolved before moving on.
3. **`/verify`** — drive the affected flow end-to-end in the real app (localhost browser),
   not just typecheck/build. Skip only for diffs with no runtime surface (docs-only).
   For any diff touching `supabase/`, `/verify` also includes running
   `supabase/tests/rls_matrix.sql` to a green `RLS MATRIX: ALL ASSERTIONS PASSED`
   (transaction-wrapped, rolls itself back — prod-safe), extended first with
   assertions for whatever the diff added or changed. Runs last: it needs the final code.
   Backed by the `verify` project skill (`.claude/skills/verify/`) and
   `scripts/verify/screenshot.mjs` (decided 2026-08-12) — use them instead of hand-rolling a
   new Playwright/CDP script per session.

**Diff-class scaling (decided 2026-07-11):** for diffs with **no runtime or schema
surface** (docs-only), run steps 1–2 **inline** — the reviewing model does each pass
itself, no agent fan-out — the same carve-out step 3 already has. The full multi-agent
gate at high effort stays mandatory for any diff touching `app-src/`, `supabase/`, any
file in `deploy.yml`'s site allowlist, or `.github/workflows/`.

This gate applies to **every** commit — `main` deploys straight to production, so the gate is
the last check before prod. A commit with an unrun or failing gate step is a process violation.

## Staging verification (MANDATORY before merging to main)

**Decided 2026-08-12.** Staging stops being an optional tier and becomes a required stop for
anything that ships to end users — marketing pages through internal platform modules alike —
since `main` deploys straight to production and the pre-commit gate only verifies the diff
locally, never the actual deployed artifact.

**Applies to:** the same scope as the gate's full multi-agent tier — any diff touching the
deploy allowlist in `scripts/assemble-site.sh`, `app-src/`, `supabase/`, or
`.github/workflows/`. **Does not apply to:** diffs with no deployed surface (`docs/`,
`CLAUDE.md`, `tests/` harnesses) — `assemble-site.sh` never ships them, so staging would be
identical before and after; there is nothing to verify.

Process, after the pre-commit gate passes on the branch and before merging to `main`:

1. Bring the branch up to date with `main`, then push it onto `staging` (merge or
   fast-forward, never force-push) to trigger `deploy-staging.yml`. **Pre-authorized:** do
   this without asking each time — `staging` never touches production and the whole tier is
   noindexed. If `staging` is already mid-verification for a different branch, sequence
   behind it rather than overwriting.
2. Wait for the deploy to finish, then smoke-check the deployed routes.
3. Give the user the live `staging.levyam.com` URL and exactly what to click through per
   change — the same click-list pattern as the localhost UI-confirmation step, but against
   the real deployed build and the real `lev-yam-staging` Supabase project.
4. **Wait for the user's explicit sign-off on staging.** Only then does the branch merge to
   `main`.

This sits between the pre-commit gate and the merge: the gate verifies the diff locally;
staging verifies the actual deployed artifact before it goes live.

## Roadmap item close-out (MANDATORY)

When a roadmap item is finished, it is not done until it is closed out:

1. **Write a close-out summary** — append a `## Close-out` section to the item's plan file
   in `docs/plans/` explaining exactly what was done: what shipped, schema/permission
   changes applied, decisions made along the way, and anything deliberately left out.
2. **Verify alignment** — check the delivered result against `docs/VISION.md` and
   `docs/ARCHITECTURE.md` and state the verdict explicitly in the summary. Any drift found
   is a conflict: raise it with the user and resolve it (see the conflict rule above)
   before the item can be marked done.
3. **Update the roadmap** — tick the item in `docs/ROADMAP.md` and add any newly
   discovered follow-up tasks.
4. **Present the summary to the user** — the item is closed only after the user has seen
   the close-out and the alignment verdict.

## Deploying

Push to `main`. The GitHub Action `.github/workflows/deploy.yml` builds the platform
(`app-src` → `/app`), bundles it with the static marketing site, and publishes to GitHub Pages
(levyam.com). `main` deploys **straight to production** — verify first against the **local
Supabase stack** (`supabase start && supabase db reset`, then `cd app-src && npm run dev`),
then, for qualifying diffs, the **staging tier** (`lev-yam-staging` / `staging.levyam.com`,
Cloudflare Pages) — see "Staging verification" above, **mandatory**, not just available. Local
dev and the `/verify` gate must **never** run against prod. Full setup:
[docs/plans/platform-staging-environment.md](docs/plans/platform-staging-environment.md).

- **The site is assembled from an explicit allowlist** in `scripts/assemble-site.sh` — the single
  copy, called by `deploy.yml` (prod) and by `scripts/build-site.sh` (staging), so the two tiers
  can't drift. A new public page or asset folder **must be added there**, or it 404s in production
  while working locally. `docs/`, `tests/`, and `supabase/` are deliberately not deployed (the repo
  is public; the *site* only serves what's listed).
- After deploying, the workflow **smoke-checks** `/`, `/app/`, `/pos.html`, `/stories/`,
  `/stories/ar/`, `/robots.txt`, `/sitemap.xml`, `/llms.txt` and `/facts.txt` (expects 200).
- **Staging tier:** pushing the **`staging`** branch triggers `.github/workflows/deploy-staging.yml`,
  which builds against the `lev-yam-staging` Supabase project and deploys to **`staging.levyam.com`**
  (Cloudflare Pages, whole-site noindex). Required flow for qualifying diffs (see "Staging
  verification" above): feature branch → `staging` (test on staging.levyam.com, user
  sign-off) → `main` (prod); keep `staging` in sync with `main`. Only `main`+`staging`
  are long-lived branches. Cloudflare token/account are repo Actions secrets; the staging
  `VITE_*` values are hard-coded in that workflow (they're the anon/publishable pair — not the
  prod `VITE_*` secrets).
- Branch pushes and PRs run **`ci.yml`** (typecheck + build) so breakage is caught before
  anything reaches `main`, which deploys straight to production.

**One-time setup:** repo Settings → Pages → Source = **GitHub Actions**; add repo Secrets
`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`; apply `supabase/schema/*.sql` and add `core`
(+ module schemas) under Supabase → API → Exposed schemas. See `supabase/README.md`.

## Repo housekeeping

- Historical pre-launch records live in `docs/archive/` (checklist, tracker, original build
  spec) — archive, not a to-do list. Active migration/feature plans live in `docs/plans/`,
  one file per initiative, linked from `docs/ROADMAP.md`.
- `.claude/`, `.DS_Store`, `node_modules/`, `app-src/dist/`, and `.env*` are git-ignored. Raw
  source media (`.MOV`, `.webm`) is ignored; only optimized assets under `img/` are committed.
- `tests/` holds Dynatrace bizevent test harnesses (open in a browser), not a unit-test suite.
