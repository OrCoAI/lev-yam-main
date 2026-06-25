# CLAUDE.md

Guidance for Claude Code (and humans) working in this repo.

## What this is

A **static site** (no build step, no npm, no frameworks) for **לב ים / Lev Yam**, a social-
business venue in the Jisr az-Zarqa fishing village. Deployed via **GitHub Pages**: pushing
to `main` publishes to **levyam.com** (custom domain via committed `CNAME`).

Three independent front-ends share the same fonts and hosting:

| Page | Purpose | Backend |
|---|---|---|
| `index.html` | Public marketing & booking site (HE/AR) | none (static) |
| `survey-june.html` | Community survey | Supabase |
| `pos.html` | Internal staff POS / billing app | Supabase |

See [README.md](README.md) for the full feature breakdown.

## Conventions & gotchas

- **No build tooling.** Edit HTML/CSS/JS directly. Test by serving the folder:
  `python3 -m http.server 8080`.
- **Bilingual (HE default + Levantine Arabic, RTL).** The marketing site's full i18n
  dictionary lives in `js/app.js`. When you add/change user-facing copy on `index.html`,
  update **both** languages and the `data-i18n` keys — don't hardcode a single language.
- **Fonts are self-hosted** woff2 subsets in `fonts/` (Heebo + Assistant, Hebrew/Latin
  splits). No external font CDN calls — keep it that way.
- **`pos.html` is internal.** It's excluded from crawlers in `robots.txt`. Don't link to it
  from public pages or add it to `sitemap.xml`.
- **Supabase keys** in `js/survey.js` and `pos.html` are the **anon/publishable** keys —
  safe to commit. Row-level security + a staff PIN (POS) are the guard. Never add a
  service-role/secret key to any committed file.
- **POS database:** `supabase_schema.sql` is the source of truth (tables, RPCs, analytics
  views). If you change the POS data model, update that file and re-run it in Supabase.
- **Analytics:** the marketing site sends Dynatrace RUM business events and a Meta Pixel
  `Contact` event from WhatsApp CTA clicks (`js/app.js`). FAQ opens and language switches go
  to Dynatrace only — intentionally **not** to Meta. Preserve that split.
- **Contact details** must stay consistent everywhere: WhatsApp `972506669138`,
  email `info@levyam.com`. There are ~12 WhatsApp CTAs on the marketing page.

## Deploying

Commit and push to `main`. GitHub Pages serves the result at levyam.com. There is no
staging environment — verify locally before pushing.

## Repo housekeeping

- `LAUNCH_CHECKLIST.md` and `PROJECT_TRACKER.md` are **historical** pre-launch records. The
  site is live; treat them as archive, not a to-do list.
- `.claude/` and `.DS_Store` are git-ignored. Raw source media (`.MOV`, `.webm`) is ignored;
  only optimized assets under `img/` are committed.
- `tests/` holds Dynatrace bizevent test harnesses (open in a browser), not a unit-test suite.
