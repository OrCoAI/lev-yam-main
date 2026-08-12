# Stories section & SEO foundation (Content Engine — Phase 0)

**Status:** in progress · kickoff 2026-08-11 · branch `content-engine-phase0`

The marketing site gets a `/stories/` section: a bilingual, mobile-first library of
answer-first pages, each owning one query cluster, plus the machine-readable surface
(sitemap, robots, `llms.txt`, `/facts.txt`, JSON-LD) that lets search engines and AI
assistants find and quote them.

> The content/marketing strategy that motivates this build is private and lives
> **outside the repo** at `docs/internal/` (gitignored — this repo is public). This
> file covers only what ships in the repo. Per the marketing-site rule, **no prices
> appear in any file here**.

## Scope

| # | Item | Ships |
|---|---|---|
| 0.0 | Privacy guard — `docs/internal/` gitignored, untracked, absent from remote | `.gitignore` |
| 0.1 | Story template + bilingual hub + homepage nav link | `stories/_template*.html`, `stories/_hub*.html`, `stories/dugma/`, `stories/ar/dugma/`, `index.html` |
| 0.2 | `robots.txt` — crawlable, no AI-bot blocks, internal surfaces still excluded | `robots.txt` |
| 0.3/0.4 | Build-time sitemap + hub generator | `scripts/gen-stories-index.mjs`, `scripts/assemble-site.sh`, `deploy.yml`, `build-site.sh`, `ci.yml` |
| 0.5 | `llms.txt` per llmstxt.org | `llms.txt` |
| 0.6 | `FACTS.md` → served as `/facts.txt` | `FACTS.md`, deploy assembly |
| 0.7 | Homepage `EventVenue` JSON-LD (replaces the stub `LocalBusiness`) | `index.html` |
| 0.8 | GA4 `whatsapp_click` event with `page_slug` on every `wa.me` link | `js/wa-track.js`, `js/app.js`, `js/stories.js` |

**Out of scope:** story *content*. Phase 0 ships the machine plus one noindex sample
page (`dugma`). Real pages are written in separate sessions.

## URL structure

```
/stories/                    Hebrew hub      (generated)
/stories/<slug>/             Hebrew page
/stories/ar/                 Arabic hub      (generated)
/stories/ar/<slug>/          Arabic page
/stories/en/<slug>/          reserved — English, not built
```

Slugs are English kebab-case and **shared across languages**, so the twin of
`/stories/team-day/` is always `/stories/ar/team-day/`. Both languages are RTL.
Every page carries reciprocal `hreflang` (`he`, `ar`, `x-default` → Hebrew).

The language toggle on a story page **navigates to the twin URL** rather than swapping
text in place — one URL per language is what `hreflang` requires, and it avoids the
homepage i18n layer's habit of overwriting `<title>`/`<meta description>` at runtime
(which would erase each page's per-page SEO metadata). It writes the same
`lev-yam-lang` key the homepage reads, so the choice carries across the site.

## Decisions taken at kickoff

| # | Question | Ruling |
|---|---|---|
| P1 | Sitemap/hub generation | **Build time**, not an auto-committing Action. `main` deploys straight to production and the pre-commit gate is mandatory for every commit — a bot commit on `main` would bypass it. `scripts/gen-stories-index.mjs` runs in `deploy.yml` before assembly; `ci.yml` runs it with `--check` so a stale committed copy fails the build instead of silently drifting. |
| P2 | GA4 custom events | **Reversed** the previous "GA4 carries no hand-written events" decision. `whatsapp_click` now fires on every `wa.me` click with `page_slug`, alongside the existing Dynatrace bizevent and Meta `Contact`. Enhanced Measurement's automatic outbound `click` stays on — this adds a richer, per-page event next to it, and gives GA4 a named event to mark as a key event. `CLAUDE.md` updated to record the reversal. |
| P3 | Seasonality facts | `FACTS.md` ships the עונתיות section as an explicit `[חסר: ...]` marker. Filled in with Nimer in a later session. |
| P4 | Sample page | `stories/dugma/` (+ Arabic twin) stays in the repo as a permanent template smoke-test, marked `noindex`. The generator excludes any `noindex` page from the sitemap and the hub, so it can never leak into production listings. |
| P5 | **Conflict — bilingual invariant vs. Hebrew-first content** | `docs/ARCHITECTURE.md` invariant 5 ("both languages for anything user-facing") **wins**. Story pages ship HE **and** AR from day one; the internal plan's Hebrew-first phasing is amended accordingly. Recorded here and in `CLAUDE.md`. |
| P6 | **Conflict — `robots.txt`** | The internal plan's `robots.txt` block omitted `Disallow: /pos.html`. `CLAUDE.md` wins: `pos.html` and `/app` stay excluded from crawlers. Only the AI-crawler policy changed (no blocks for GPTBot, ClaudeBot, PerplexityBot, Google-Extended). |
| P7 | **Conflict — `404.html`** | The internal plan asked for a "styled 404". The existing `404.html` is a load-bearing router that hands `/app/*` deep links to the SPA — replacing it would break platform deep links. Resolution: keep the router exactly as-is, add styling and a visible no-JS fallback around it. |

## Architecture & vision check

- **Invariant 3 (no PII/secrets in the public repo)** — held. `docs/internal/` is
  gitignored (0.0, verified against history and `origin/main`); `FACTS.md` carries only
  publishable facts and zero prices.
- **Invariant 5 (HE + AR, RTL correct in both)** — held, and strengthened: see P5.
  **Scope note (decided at the 2026-08-12 gate):** the invariant covers surfaces
  people *read* — pages, UI, the 404. `llms.txt` and `FACTS.md`→`/facts.txt` are
  machine-readable surfaces for crawlers/assistants and are deliberately exempt
  (Hebrew + English annotations, per llmstxt.org convention); an Arabic
  translation there would serve no crawler and drift from the single fact
  source. Recorded here so the exemption is a decision, not an oversight.
- **Invariant 7 (live tools keep working)** — held. `pos.html`, `/app`, the survey and
  the homepage are untouched apart from the nav link, the JSON-LD swap and the shared
  analytics extraction, all of which the gate's `/verify` step exercises.
- **Deploy allowlist** — `stories/`, `llms.txt` and `FACTS.md`→`facts.txt` are added to the
  allowlist, which the `/simplify` pass collapsed into a single `scripts/assemble-site.sh`
  called by both tiers (it had been duplicated between `deploy.yml` and `build-site.sh`,
  a two-place edit whose failure mode is a production-only 404 staging never reproduces).
- **Vision** — `docs/VISION.md` puts the village, its people and the social-business
  model at the centre. The facts guardrail (`/facts.txt` as the only source, `[חסר]`
  rather than invention, quotes verified with the person named) is what keeps that
  honest as content volume grows.

## Redesign (2026-08-11) — "simple, same flow as the site"

Decided with Or before first commit; researched via a 3-lens workflow (editorial hub
patterns, article-page patterns, site vocabulary + HE/AR typography) synthesized into a
spec, implemented, then adversarially design-reviewed. Governing choices:

- **Hub** — newest story as a large featured card (photo/text split ≥820px, stacked 3:2
  below), all other stories in a uniform photo-card grid (4:3, services-card language).
  Cards are generated: each story's `og:image` (a required real 1200×630 photo under
  `/img/stories/<slug>/`) is the card photo — the generator fails the build on a logo or
  off-site URL. Date is the only card metadata.
- **Story page** — contained 2:1 photo hero (edge-to-edge 3:2 under 640px, LCP-preloaded),
  title on cream below it (never text-over-photo), answer-first lede as large type closed
  by an orange rule (the boxed callout is gone), 40rem reading measure, figures/video span
  the 760px column with one optional full-bleed breakout, self-hosted 16:9 mp4 video block
  (`preload="none"`, poster required, ≤8MB).
- **Header** — all six homepage nav items + WhatsApp icon + lang toggle; nav on its own
  scrollable row below 900px, inline + sticky above.
- **Type system** — `--story-*` tokens; body 17→19px lh 1.7; `html[lang=ar]` overrides
  leading (1.85/1.75/1.3) and zeroes tracking — the entire per-language delta.
- **Headings are ink** (like the homepage's `.section-title`) on cream; on the blue bands
  titles go cream, exactly as homepage band titles do. Blue-deep is reserved for
  navigational titles (cards, related links).
- **Restraint** (deliberately not built): text-over-photo, scroll animations, share rows,
  reading time, tags, carousels, custom video chrome, photo related-cards, fade masks.

### Unification pass (2026-08-11, same day)

Or's review verdict on the first cut: technically on-brand but "it feels not one
website" — and he was right. The homepage speaks a macro-language of colored bands,
zigzag wave dividers, centered cream band-titles and the color logo mark; the stories
pages had only the micro pieces (fonts, cards, buttons). Ruling (his pick from three
options): **blue band + waves** — pull the homepage's own furniture into the story
seams, keep the reading column quiet. All reused from `styles.css`, never re-implemented:

- **Header** is now the Lev Yam blue band: cream nav links, `logo-mono-nobg.png` (the
  homepage header/footer mark), and the homepage `.lang-toggle` verbatim — its dark-glass
  skin is built for exactly this ground, so the stories re-tint was deleted.
- **Hub arrival** — the band continues through breadcrumbs + `.section-title` h1 +
  standfirst (cream on blue, centered), closed by `wave-divider--orange` into the cards.
- **Every page closes** `wave-divider--blue` → CTA band in the homepage `.contact`
  language (blue→blue-deep gradient, warm top glow, logo mark, white lead, orange
  `.btn-primary`) → the homepage `.site-footer` **verbatim** (icon row, credit, discreet
  staff login; per-language text baked into the HTML — story pages run no i18n layer).
- **Story pages** open header-band → `wave-divider--orange` → photo hero; the article
  column between the seams is deliberately unchanged.
- The per-intent CTA icons (house/heart/sun/palm) were dropped — the band carries the
  logo mark instead.

## Follow-ups (from the 2026-08-12 gate — logged, deliberately not done now)

- **Chrome stamping** — header/footer/wa-float markup is copied across the 4
  underscore templates and every story pair (~180 lines each). The generator
  already rewrites these files; teach it to stamp (or at least verify) shared
  chrome so a nav/footer change stops being an N-file edit. Two review rounds
  flagged it; deferred as an architecture change, not a gate fix.
- **Hamburger module** — js/stories.js's drawer toggle mirrors js/app.js
  line-for-line (label source differs). Extract to a shared file (the
  wa-track.js precedent) the next time either copy needs a behavior fix; until
  then the copies are kept diffable.
- **Card idiom tokens** — .story-card re-types .service-card's hover/tint/
  underline constants; worth shared tokens/base class next time the card
  language changes.
- **Dynatrace tag** — synchronous and below the stylesheets on every page
  (homepage pattern). Moving it above the CSS (or async variant) is a
  site-wide decision to take for homepage + stories together.
- **Hub card srcset** — the generator emits the full 1200×630 card.jpg for
  ~300-400px grid cells; adopt a `card-600.jpg` convention + `srcset` when the
  first real story lands (images were recompressed hard in the meantime).
- **404 /app router drops `location.search`** — pre-existing: query params are
  lost on refresh/deep-link (`?p=` route survives, `?foo=bar` doesn't; hash
  IS preserved, which is what Supabase invite links use). Fixing it needs the
  app-src side to restore the params — a platform change, tracked for the
  platform backlog.
- **deploy.yml smoke list** — hand-maintained mirror of assemble-site.sh's
  allowlist; could be a probe manifest the script emits.

## Accept criteria

- `stories/dugma/` and `stories/ar/dugma/` render correctly on mobile (390px) and desktop,
  reachable homepage → hub → page in both languages, and pass the Rich Results Test for
  `FAQPage` + `BreadcrumbList`.
- Adding a story folder and pushing updates `sitemap.xml` and both hubs automatically,
  with no workflow self-trigger and no bot commit.
- `robots.txt`, `sitemap.xml`, `llms.txt`, `/facts.txt` all return 200 after deploy.
- Zero pricing anywhere in the repo; no invented facts in `FACTS.md`.
- GA4 DebugView shows `page_view` + `whatsapp_click` with the correct `page_slug` from a
  test click on the sample page and on the homepage.
- `CNAME` survives the deploy; `404.html` still routes `/app/*` deep links.

## Close-out (2026-08-12)

**Shipped:** everything in Scope (0.0–0.8) plus the redesign — `/stories/` renders as one
visual system with the homepage (shared `.hero-topbar`/`.primary-nav`/`.header-social`/
`.nav-toggle`/`.mobile-nav`, `.wave-divider`, `.section-title`, `.site-footer`, the
`--band-blue-glow` contact-band gradient), verbatim, not re-implemented. `stories/dugma/`
(+ Arabic twin) is the permanent noindex template smoke-test; the hub is live in its
documented empty state until real stories are written (out of scope here, per Scope §
"Out of scope"). All four pre-commit gate steps ran clean; PR #42, merged, deployed to
staging then production, both smoke-checked green.

**No schema/permission changes** — this track is entirely static-site (`index.html`,
`stories/`, `robots.txt`, `sitemap.xml`, `js/`, `css/`) plus the deploy workflow; it touches
no Supabase schema, RLS, or `core.permissions`.

**Decisions made beyond the original scope:**
- The redesign itself (blue band + waves, homepage chrome reused verbatim) — Or's call
  after reviewing the first cut on localhost and judging it didn't read as "one website."
  See "Redesign (2026-08-11)" and "Unification pass" above for the governing choices.
- `/code-review high` and `/security-review` now run **concurrently** rather than
  sequentially (both are independent read-only findings-passes over the same diff) —
  folded into `CLAUDE.md`'s gate description alongside this work.
- Staging verification promoted from optional to **mandatory** before any deploy-surface
  diff merges to `main` — also folded into `CLAUDE.md`, and exercised for real on this PR
  (staging.levyam.com smoke-checked, Or signed off, then merged).
- The pre-commit gate's `/verify` step is now a checked-in project skill
  (`.claude/skills/verify/`) backed by `scripts/verify/screenshot.mjs`, replacing the
  pattern of hand-rolling a fresh Playwright/CDP script every session.

**Deliberately left out** (logged in "Follow-ups" above, not gate blockers): chrome
stamping/verification across the four underscore templates, a shared hamburger-drawer
module, shared card-hover tokens, hub-card `srcset`, the pre-existing `404.html` router
dropping `location.search` on `/app` deep links (platform-side fix), and a
`deploy.yml` smoke-list generated from the allowlist instead of hand-mirrored.

**Alignment verdict:**
- `docs/VISION.md` — held. The redesign strengthens this: content that shares the
  homepage's furniture reads as part of the social-business venue's own voice, not a
  bolted-on SEO play, which is what the facts guardrail (`/facts.txt`-only, `[חסר]` over
  invention) was already protecting.
- `docs/ARCHITECTURE.md` invariant 5 (HE+AR everywhere user-facing) — held, and its scope
  was clarified rather than drifted: `llms.txt`/`/facts.txt` are machine-readable crawler
  surfaces and are recorded as a deliberate exemption (see the invariant-5 note above),
  not a silent gap.
- No conflict surfaced against either doc during the redesign or the gate; nothing was
  worked around.
