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

## Conventions & gotchas

### Marketing site (`index.html`, `survey-june.html`, `pos.html`)
- **No build tooling.** Edit HTML/CSS/JS directly. Test by serving the folder:
  `python3 -m http.server 8080`.
- **Bilingual (HE default + Levantine Arabic, RTL).** The marketing i18n dictionary lives in
  `js/app.js`. When you add/change user-facing copy on `index.html`, update **both** languages
  and the `data-i18n` keys — don't hardcode a single language.
- **Fonts are self-hosted** woff2 subsets in `fonts/` (Heebo + Assistant, HE/Latin splits). No
  external font CDN calls — keep it that way.
- **Analytics:** the marketing site sends Dynatrace RUM business events and a Meta Pixel
  `Contact` event from WhatsApp CTA clicks (`js/app.js`). FAQ opens and language switches go to
  Dynatrace only — intentionally **not** to Meta. Preserve that split.
- **Contact details** must stay consistent everywhere: WhatsApp `972506669138`,
  email `info@levyam.com`. There are ~12 WhatsApp CTAs on the marketing page.

### Platform (`app-src/`, served at `/app`)
- **Stack:** Vite + React 18 + TypeScript + react-router. Dev: `cd app-src && npm run dev`
  (runs at `localhost:5173/app`). Build/typecheck: `npm run build`.
- **Vite `base` is `/app/`** and the router `basename` is `/app` — keep them in sync if the
  hosting path ever changes.
- **Permissions are role → module → action.** The DB enforces them via RLS calling
  `core.has_permission('<module>.<action>')`; the UI mirror (`lib/permissions.ts`,
  `RequirePermission`, `useCan`) is convenience only. Never rely on UI gating alone.
- **One Supabase client** (`lib/supabase.ts`); query a module's schema with
  `supabase.schema('<module>')`. Permission keys are constants in `lib/permissions.ts`.
- **A new module** = a Postgres schema + RLS in `supabase/schema/`, a row in `core.modules`,
  permission rows in `core.permissions`/`core.role_permissions`, a folder in `src/modules/`,
  a route in `App.tsx`, and a launcher destination in `shell/Launcher.tsx`.

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
  there and re-run it in the Supabase SQL editor. Add new module schemas in the same folder.

## Deploying

Push to `main`. The GitHub Action `.github/workflows/deploy.yml` builds the platform
(`app-src` → `/app`), bundles it with the static marketing site, and publishes to GitHub Pages
(levyam.com). There is no staging — verify locally before pushing.

**One-time setup:** repo Settings → Pages → Source = **GitHub Actions**; add repo Secrets
`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`; apply `supabase/schema/*.sql` and add `core`
(+ module schemas) under Supabase → API → Exposed schemas. See `supabase/README.md`.

## Repo housekeeping

- Historical pre-launch records live in `docs/archive/` (checklist, tracker, original build
  spec) — archive, not a to-do list.
- `.claude/`, `.DS_Store`, `node_modules/`, `app-src/dist/`, and `.env*` are git-ignored. Raw
  source media (`.MOV`, `.webm`) is ignored; only optimized assets under `img/` are committed.
- `tests/` holds Dynatrace bizevent test harnesses (open in a browser), not a unit-test suite.
