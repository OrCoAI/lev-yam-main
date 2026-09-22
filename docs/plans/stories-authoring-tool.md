# Stories — Story pages at cadence + the authoring tool

*Kickoff 2026-09-22 · branch `stories-authoring-tool` · roadmap block: Phase 2 — 2026-Q4 mandate,
item 2 ([ADR 0046](../decisions/0046-q4-2026-mandate-marketing-quarter.md)) · tier: **A** (ADR 0015 —
`.claude/skills/`, `CLAUDE.md` and `.gitignore` are the leash class, ADR 0036, and `scripts/*.sh` is A;
the generator, templates and pages are B; docs C)*

## Why

Phase 0 of the content engine ([content-engine-phase0.md](content-engine-phase0.md), shipped
2026-08-12) built the machine — template, HE/AR twin rule, generated hub + sitemap, `facts.txt`,
`whatsapp_click` with `page_slug` — and **zero real stories have been written since**. The hub is
live in its empty state; the only page is the `noindex` sample. Every marketing outcome in the
Q4 mandate (items 3–10) lands on story pages, and the analytics now wired (item 1) has nothing
under `/stories/` to measure. The cost of writing a page by hand today: copy two 330-line files,
fill ~25 placeholders twice, hand-check facts against `FACTS.md`, produce three image sizes, and
keep the ~180 lines of copied chrome in step with the homepage — which is why none exist.

## Outcome metric

| | |
|---|---|
| Metric | **Real story pairs live and indexed** (primary) and **Search Console impressions for `/stories/` URLs** (primary); `whatsapp_click` events with a `/stories/` `page_slug` recorded as a secondary number, not pass/fail |
| Source | repo (`sitemap.xml` entries minus `dugma`) · `.reports/analytics.json` GSC pages block via `weekly-review` · GA4 `whatsapp_click` by `page_slug` |
| Baseline (today) | 0 pairs · 0 impressions · 0 clicks (2026-09-22) |
| Target | 4 pairs live and indexed · impressions > 0 on at least 2 of the 4 · clicks: any |
| Check date | **2026-10-25** (planned merge of the last pair by 2026-10-04 + 3 weeks; corrected at close-out to the real merge date + 3 weeks) — `weekly-review` lists it when due |
| Verdict owner | owner |

"Cannot tell" is a finding about GSC latency, not a pass: if impressions are empty at the check date
the verdict names whether the URLs are indexed (GSC URL inspection) before blaming the pages.

## Scope

The thinnest slice that gets a story pair from a brief to a reviewable PR, proven by shipping four.

1. **`story-author` skill** (`.claude/skills/story-author/`): from a one-paragraph brief (topic,
   target query in Hebrew, intent) it produces
   - the Hebrew page from `stories/_template.html` and the Arabic twin from
     `stories/_template.ar.html`, same slug, every placeholder filled;
   - facts only from `FACTS.md` — anything missing becomes a `[חסר: …]` / `[مفقود: …]` marker
     **and** a per-page gap list the owner answers in session; answers go into `FACTS.md` in the
     same PR (verified with Nimer where the fact is his). No page merges with a marker in it;
   - meta title ≤60, description ≤155, `BreadcrumbList` + `FAQPage` JSON-LD matching the visible
     text, 2–3 internal links, answer-first lede, 250–500 words, one fact per sentence, no
     superlatives, **no prices**;
   - Levantine Arabic drafted from the approved Hebrew; the PR waits for a native reader's sign-off
     (owner / Nimer) before merge;
   - a 3-case `EVALS.md` like every other product skill.
2. **Photo intake folder `media/`** at the repo root, **gitignored** (same rule as the raw hero
   video): the owner drops originals there over time; the skill lists candidates per page, the
   owner picks, and the skill writes only the optimized derivatives the template needs —
   `img/stories/<slug>/card.jpg` (1200×630), `hero-800.jpg`, `hero-1600.jpg` (2:1) — which are
   committed. `media/README.md` (committed) explains the folder.
3. **Chrome stamping in `scripts/gen-stories-index.mjs`**: the header and footer of every story
   page **and of both hub templates** are marked regions (`chrome:header` / `chrome:footer`
   comment markers) that the generator **rewrites in place** from the per-language page template
   on every run; `--check` fails CI on drift. Inside a region only three variables may appear:
   the language-toggle URLs and the nav's `aria-current` (set on the hub only). The article
   column, `<head>` metadata, CTA band and WhatsApp float are outside every region — the last two
   carry per-page text (item 5 owns the CTA). The generator also refuses a non-kebab slug, a
   leftover `{{PLACEHOLDER}}` anywhere in a page, a referenced `/img/stories/…` file that does
   not exist, and an `og:image` other than `/img/stories/<slug>/card.jpg`. Closes the Phase 0
   follow-up "chrome stamping" for all four underscore templates.
4. **Four real story pairs**, positioned per the mandate line (private and business events, the
   venue and what it gives people):
   - team day by the sea in the north (flagship);
   - venue for a company event near Caesarea / Hadera;
   - how to get to Jisr az-Zarqa and the fishing village;
   - a private event on the beach.
   Each pair is its own PR after the tool PR, so the owner's review is one page at a time.
5. `sitemap.xml` and both hubs regenerated by the existing build step; `dugma` stays `noindex`.

## Explicitly out of scope

- **English stories** — reserved URL space, not built this quarter (ADR 0046).
- **Scheduled / automated drafting** (the weekly engine, `@claude` from a brief issue) — mandate
  item 11; this initiative makes it possible, item 11 wires the trigger.
- **Per-page prefilled WhatsApp CTA text, click-to-call, sticky CTA** — mandate item 5. The CTA
  band stays the template's generic one so stamping has one source; item 5 parameterizes it.
- **`FAQPage` / `Event` JSON-LD expansion, `llms.txt` / `facts.txt` growth beyond what the four
  pages need** — item 4.
- **Local-SEO pages** (directions page is here only because it is a cornerstone; the cluster is
  item 3), **social posts** (item 6), **GBP** (item 7).
- **Filling all 16 `FACTS.md` gaps** — only the gaps a page needs, per page.
- **Any Supabase, platform or `app-src/` change** — none.
- **Hub card `srcset`** (Phase 0 follow-up) — logged, still deferred; revisit when the hub has more
  than four cards.
- **Running `story-images.sh` on Linux** — the pipeline is Pillow, so it runs on the Actions
  runner too; only HEIC sources need macOS `sips`. Mandate item 11 (automated drafting on the
  runner) should convert HEIC on intake. Logged for item 11's kickoff.

## Schema, RLS, permissions

**None.** Static site + one build script + one skill. `rls_matrix.sql` gains nothing.

## UI surface

- Public: `/stories/<slug>/` + `/stories/ar/<slug>/` × 4, both hubs, `sitemap.xml`. HE + AR by
  construction (ADR 0007, invariant 5); both RTL.
- Homepage: untouched (the nav link to `/stories/` already exists).
- Step zero per page: headless-Chrome screenshots at 360 / 390 / 1280 of both twins and both
  hubs; overflow report must be clean (ADR 0009). Owner's human look happens once on staging per
  PR (Tier B surface; the Tier A declaration is for the skill files, which have no deployed
  surface).

## Rollback

Revert the PR, or flip a page to `noindex` — the generator then drops it from the hub and the
sitemap on the next build — and request removal in Search Console. Chrome stamping is a pure
function of the templates: reverting the generator change leaves every page byte-identical to
its last stamped state. No data left behind anywhere; `media/` is local only.

## Checks

- **Roadmap:** current block — Phase 2 Q4 mandate item 2, next in the owner's order after item 1
  (shipped 2026-09-22). Linked from `docs/ROADMAP.md`. ✅
- **Architecture** (§6–7): no permissions, no schema, no spines (invariants 1, 2, 4, 6 not
  engaged). Invariant 3 (no PII / secrets / prices in a public repo) — held: `media/` is
  gitignored so originals never enter history; `FACTS.md` remains the only fact source; no
  prices; member bylines only with the named person's consent. Invariant 5 (HE + AR everywhere
  user-facing) — held by construction, and strengthened by the native-reader sign-off.
  Invariant 7 (live tools keep working) — the generator's `--check` in CI protects the
  existing hub / sitemap contract; `dugma` remains the template smoke test. Invariant 8
  (`ROADMAP.md` the single tracker) — held. **Verdict: no conflict.**
- **Vision:** serves the **Join** circle — being found, understood and contacted — which
  ADR 0046 sequences before Create this quarter. Principle 5 (bilingual from day one) held;
  principle 1 (community as creators) is not broken — the bylined member-voice pages are the next
  cornerstones after these four. **Verdict: aligned.**

## Open questions

- **Blocking, owner:** the per-page `[חסר]` answers as each page is drafted (answered in session
  per the kickoff decision). The directions page in particular needs the public-transport and
  accessibility gaps in `FACTS.md` §מיקום והגעה, or ships saying they are unverified.
- **Blocking, owner + Nimer:** Arabic sign-off per pair before merge.
- **Non-blocking, Claude:** exact chrome-region boundaries — decided in the build; the constraint
  is that the article column and the `<head>` metadata are outside every region.
- **Non-blocking, owner:** run one real portrait iPhone HEIC through `scripts/story-images.sh … --focus top`
  once and eyeball the result — the rotation path was proven on a synthetic HEIC only (camera HEICs
  carry the rotation in a second place `sips` may or may not bake in).
- **Non-blocking, owner:** the first drop of photos into `media/`. Five gallery files already
  pass the script, so the flagship page is not blocked on it; new subjects (a company day, a
  private dinner) will be.

## Follow-ups discovered (logged, not done here)

- **AR header at 1280px:** the WhatsApp icon in `.header-social` overlaps the last nav item
  ("تواصلوا معنا") on the Arabic pages — pre-existing (verified against `main` during step zero
  on 2026-09-22), untouched by this diff. Now a one-line fix in `_template.ar.html` thanks to
  stamping; do it with the first real Arabic page, where it will be looked at on staging anyway.

## Decisions made on the way

- 2026-09-22 · kickoff · photo originals live in a gitignored `media/` intake folder; only
  optimized derivatives are committed (owner). Recorded here; not an ADR — it extends the existing
  raw-media rule in `.gitignore` rather than changing one.
- 2026-09-22 · kickoff · the generator **rewrites** chrome in place (not verify-only) — closes the
  Phase 0 follow-up as an architecture change (owner).
- 2026-09-22 · kickoff · a story pair merges only with a native reader's sign-off on the Arabic
  and with zero `[חסר]` markers (owner).

- 2026-09-22 · build · the **CTA band and the WhatsApp float are not stamped** — both carry
  per-page text (`{{CTA_LEAD}}`, the prefilled message, `data-bizevent-source="stories_<slug>"`),
  so only `header` and `footer` are chrome regions; item 5 owns the CTA. The review found the
  hub templates carried a third copy of the same chrome, so the hubs are stamped too, through
  three named variables instead of a bare `{{SLUG}}` — [ADR 0049](../decisions/0049-story-chrome-is-generated-and-a-pair-merges-complete.md).
- 2026-09-22 · build · `story-images.sh` moved from `sips` to **Pillow**: the security review
  reproduced GPS coordinates surviving `sips` into a would-be public `card.jpg`; the re-review
  then showed `sips` ignores the EXIF rotation flag (portrait phone photos would ship sideways)
  and that dropping an iPhone's Display P3 profile without converting shifts colours. Pillow
  applies the rotation, converts to sRGB, writes from pixels only, and **refuses a source under
  1600×800** (the hero is the LCP image). `sips` stays only as the HEIC converter. Recorded in
  `media/README.md`.
- 2026-09-22 · build · the homepage gallery is a **partial** photo source: five files
  (`08`, `09`, `10`, `14`, `18`) are 1600×1200 and pass the script; the rest are ≈700 px or
  portrait. The `media/` intake is still where new photos go, but the flagship page is not
  blocked on it.

## Status

- 2026-09-22 — tool half built, gate run, on staging as [PR #79](https://github.com/OrCoAI/lev-yam-main/pull/79);
  awaiting the owner's staging sign-off. Next: photos into `media/`, then the flagship pair
  (team day by the sea) via `story-author`, its own PR.

## Close-out
*(appended when done — CLAUDE.md "Roadmap item close-out")*

## Outcome check
*(appended on 2026-10-25: metric value vs target, verdict, what it changes)*
