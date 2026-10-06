# Video — Remotion pipeline: guidelines, the `new-video` skill, a weekly research PR

*Kickoff 2026-10-06 · branch `video-pipeline` · roadmap block: Phase 2 — 2026-Q4 mandate,
item 15 ([ADR 0046](../decisions/0046-q4-2026-mandate-marketing-quarter.md); the item is the owner's
addition, [ADR 0064](../decisions/0064-video-is-made-with-remotion-in-the-repo-guidelines-are-the-leash-refreshed-weekly-by-pr.md)) ·
tier: **A** (ADR 0015 — `.claude/skills/`, `CLAUDE.md`, `.gitignore`, `scripts/check-tier.mjs` are the
leash, ADR 0036; `.github/workflows/` is A; `video/` itself is B; docs C)*

## Why

Two reels were built on 2026-10-05 in a Remotion project outside this repo — the weekend open-house
reel (HE + AR, two hook variants each) and an ambient sunset loop — with no written rules: the safe
zone came from a popular prompt (150 / 170 px) rather than Meta's own spec (269 / 672 px), the
testimonial cut carried reviewers' first names and a kitchen worker's name had to be trimmed by
hand, and nothing recorded which Remotion version or which agent-skill version the work assumed.
The owner's research (2026-10-06, the source of the guidelines) says the same thing every serious
practitioner found: the quality of an agent-made video comes from a shot-list brief, a locked
brand kit and a render-and-look loop — not from a clever prompt — and the advice moves monthly
(Remotion ships weekly; platform specs change). Without guidelines in the repo, a skill that
builds the brief with the owner, and a loop that keeps the guidelines current, every reel is a
fresh improvisation and the public-repo rules get re-discovered the hard way.

## Outcome metric

| | |
|---|---|
| Metric | **Reels published from a `new-video` brief** (primary; a reel counts once its MP4 was posted on Instagram/Facebook, logged below with brief slug, language, hook variant and date) · **weekly refresh PRs** (process: one PR or one "no change" summary per week, none merged without the owner) · **social-referred sessions and `whatsapp_click`** (secondary, reported not pass/fail — Instagram/Facebook as the GA4 source, from the weekly analytics snapshot) |
| Source | this plan's publish log · `gh pr list --label video-guidelines` + the workflow's run summaries · `.reports/analytics.json` via `weekly-review` |
| Baseline (today) | 0 reels published from a brief (2 built by hand outside the repo, rendered 2026-10-06, none posted) · 0 refresh runs · social-referred numbers: first read from the next weekly report (2026-10-11) |
| Target | 4 reels published from briefs within 4 weeks of ship (1 a week: the weekend open house in HE and AR, then two initiative promos), each in both languages · 4 of 4 weekly runs produced a PR or a logged "no change", 0 auto-merged · social sessions > 0 and at least one `whatsapp_click` with a social source |
| Check date | **2026-11-10** (planned ship 2026-10-13 + 4 weeks; corrected at close-out to the real merge date + 4 weeks) — `weekly-review` lists it when due |
| Verdict owner | owner |

"Cannot tell" on the secondary number is a finding about the snapshot (does it break sessions
down by source?), not a pass. The hook-rate per variant lives in Meta Insights, which nothing in
the repo reads; the publish log carries it by hand when the owner looks.

## Scope

The thinnest slice that gets a reel from an owner's idea to a reviewed MP4 under written rules,
with the rules kept current.

1. **`video/` — the Remotion project, inside the repo, never deployed.** The 2026-10-05 project
   migrates in (compositions `WeekendReel-he/-ar` × 2 hooks, `SunsetDream`, `LevYamTestimonial`,
   the brand parts, the five brand transitions). Node 22 (`.node-version`), `npm ci`,
   `npm run dev` (Studio), `npm run lint` (eslint + tsc). Not on the assemble allowlist, so nothing
   under `video/` reaches levyam.com; `ci.yml`'s required `build` job gains `npm ci` + `npm run lint`
   for `video/` so a broken video project fails the branch, never prod. Renders (`video/out/`) are
   gitignored.
   - **Assets are the site's own.** `video/public/site/` is *generated* from `img/` by
     `npm run assets` (`video/scripts/sync-assets.mjs` is the map) and gitignored — the 16 photos,
     icons and the hero clip the reels use are byte-identical to files already in `img/`, so the
     repo never carries a second 12 MB copy. Only derivatives that exist nowhere else are
     committed: three recoloured brand icons (`video/public/brand/`) and one terrace photo
     (`video/public/photos/`). Raw clips stay in the gitignored `media/` intake, as for stories.
   - **Public-repo rules applied on the way in:** reviewer first names in the testimonial data
     become neutral labels; the kitchen-staff trim stays; no prices anywhere; every on-screen
     fact traces to `FACTS.md` or the live `/happening/` page it was read from.
   - The Meta safe-zone tokens and a Studio-only `<SafeZone>` guide join the kit (the two
     existing reels keep their 2026-10-05 layout — see out of scope).
2. **Guidelines** — `video/GUIDELINES.md` (moved out of `.claude/` on 2026-10-06, see ADR 0064), the one rule file for video:
   distilled from the owner's research document and the installed official Remotion Agent Skills
   (`remotion-dev/skills` 4.0.532, per machine), plus the repo's own rules (facts, names, HE + AR,
   Arabic review, never deployed, license). Sections: rules of the house · formats and platforms
   (Meta only this quarter) · safe zones · typography and RTL · motion · structure and the kit ·
   hooks and content · assets · workflow and the three human gates · rendering · versions ·
   anti-patterns · out of scope · sources with confidence · dated changelog. It lives inside the
   skill folder on purpose: an agent instruction file is the leash (ADR 0036, Tier A), so every
   change to it — human or the weekly job's — is a PR the owner reads.
3. **`new-video` skill** — builds the brief *with* the owner: closed questions one at a time
   (type, audience, the single CTA, formats, duration band, languages, two hook variants, the shot
   list, assets, facts), then writes `video/briefs/<slug>.md` from `brief-template.md`: a complete,
   self-contained prompt (spec, safe zone, type minimums, numbered shots with seconds and exact
   HE + AR copy, assets by path, motion from the kit, acceptance checks, render matrix). Gate 1 =
   the owner approves the storyboard; then one closed question: run it now (this session builds it
   with the Remotion skills, Studio open, stills reviewed) or later (`/new-video run <slug>`).
   Never renders the final MP4, commits, pushes or publishes on its own. `review.md` is the
   reviewer subagent's checklist (stills at hook / mid / CTA frames per language: safe zone, type
   minimums, RTL order and Arabic joining, facts vs the brief, CTA hold, no logo in the first 3 s).
   A 3-case `EVALS.md` like every product skill.
4. **Weekly research PR** — `.github/workflows/video-guidelines-refresh.yml`, Mondays 05:00 UTC
   and on `workflow_dispatch` (the acceptance test): a research job on a read-only token reads
   Remotion releases, the official skills, the license page and a few web searches and edits
   `video/GUIDELINES.md` alone; a fixed step hands its patch (secret-scanned by `report-guard.py
   --scan-only`) to a publish job with no agent, which opens the Tier-A PR
   `video-guidelines/<ISO week>`. The owner merges; nothing auto-merges. The mechanism and its
   threat model are the workflow's header and ADR 0064 §5. A PR opened with `GITHUB_TOKEN` gets
   no CI run until closed and reopened; an optional fine-grained `VIDEO_GUIDELINES_PAT` (this
   repo only, contents + pull requests write) makes it automatic.
5. **Harness edits:** `CLAUDE.md` (a Video conventions block, the automations row, the tier
   table), `.gitignore`, `.github/dependabot.yml` (a `/video` npm entry with every `remotion` /
   `@remotion/*` package grouped, since they must share one exact version), `ci.yml`,
   `scripts/check-tier.mjs` (dependabot bumps of `video/package*.json` are C).

## Explicitly out of scope

- **Audio** — no music or SFX in v1 (owner, 2026-10-06): reels are silent-safe with burned-in
  text; an audio file enters `video/public/` only with a license line. Voiceover / TTS and caption
  transcription are documented as the next step, not built.
- **Platforms beyond Meta** — TikTok and YouTube Shorts safe-zone profiles wait; WhatsApp status
  reuses the 9:16 file unverified.
- **English reels** — mirrors the roadmap's "no `/stories/en/` this quarter".
- **Publishing automation** — the owner posts by hand after Gate 3; scheduling tools and
  mandate item 6's social pipeline are separate.
- **Cloud rendering / Player / SaaS** — local renders only; Lambda and the Player are a later
  decision with a license implication.
- **A render smoke in `ci.yml`** (one still when `video/` changes) — the follow-up Tier-A PR right after this one (decided 2026-10-06).
- **Re-layout of the two existing reels to the Meta safe zone** — the second follow-up, not this PR
  (their renders of 2026-10-06 must stay reproducible for the owner's first posts).
- **Vendoring the official Remotion skills into the repo** — stays per machine (owner, 2026-10-06).

## Schema, RLS, permissions

None. `video/` has no runtime and no backend; nothing touches `supabase/`.

## UI surface

No page or module changes. The surface is Remotion Studio on localhost (`cd video && npm run dev`)
and the rendered MP4s. Every reel ships in HE **and** AR (invariant 5 binds user-facing content);
Arabic copy may be machine-drafted but is never posted unreviewed (the ADR 0055 rule, applied to
video). Phone-first by nature: 1080×1920, Meta safe zones, the reviewer's stills are the step-zero
screenshots.

## Rollback

Revert the PR: `video/` has no runtime, so removing it changes nothing live. The weekly job stops
when its workflow file is deleted or its schedule removed; its open PRs are closed. No data is
left behind beyond gitignored renders on the owner's machine.

## Checks

- **Roadmap:** not in the mandate list as proposed on 2026-09-22; the owner added it as item 15
  (2026-10-06) rather than folding it into item 6 — the mandate list is the owner's to reorder
  (roadmap lead paragraph). Written back as item 15 in this PR.
- **Architecture:** invariants 1, 2, 4, 6, 7 not touched (no tables, no keys, no live tool).
  **3 (no PII in the public repo):** reviewer names → neutral labels, staff names never, the
  owner's signature never, raw media gitignored — verdict: holds. **5 (HE + AR, RTL correct):**
  every reel has both languages before it is posted; the kit's `Bidi` part isolates digits; the
  Arabic rules (per-word animation, no letter-spacing, no stroke) are in the guidelines —
  verdict: holds. **8:** roadmap updated. §6c (branch protection, Tier A human review) is what
  the weekly PR relies on — the job cannot merge, by permission and by design.
- **Vision:** serves principle 4 (*public by default* — the venue's life shown openly) and the
  **Join** circle (guests see what happens and come); principle 5 (bilingual from day one) is
  enforced, not retrofitted. Must not break principle 3 — nothing here is gated by the UI alone
  because nothing here has a UI gate at all.

## Acceptance of the weekly job (the first `workflow_dispatch` on main must show)

1. A `WebFetch` to a host outside the seven allowed domains is **denied** in the run transcript —
   the one load-bearing proof. The repo saw the action drop a path specifier on a `Write` allow
   (it failed closed); if a `domain:` specifier on `WebFetch` were dropped open, the agent could
   fetch any host. Until shown, the schedule is not trusted; if it fails open, WebFetch is removed
   and the sources are fed another way.
2. The OAuth token is not reachable by `Read`: `//proc/self/environ` and anything under
   `~/.config` are refused (the denies use the `//` absolute form; a single leading slash anchors
   at the checkout — also corrected in `agent-report.yml` in this PR).
3. The tool roster the action registers contains nothing beyond Read, Glob, Edit, WebSearch and
   the scoped WebFetch (no shell, no write surface).
4. A "no change" run exits clean; a change run opens exactly one PR with the Tier line; a re-run
   the same week updates it.

## Open questions

- **Blocking for the first posted weekend reel — the live page's hours:** `FACTS.md` now carries
  the seasonal weekend hours (2026-10-06); the `/app/events` weekend item (→ `/happening/weekend/`)
  still shows other hours and must be edited by the owner to match before the reel is posted
  (the Arabic cost field there also says "حر" — "ببلاش" is the fix).

## Decisions made on the way

- 2026-10-06 · Remotion lives in the repo under `video/`, never deployed; the guidelines are an
  agent instruction file (leash, Tier A) and the weekly research job is a separate worker that
  opens a PR the owner merges; video is mandate item 15; no audio in v1; Meta only; the official
  Remotion skills stay per machine → [ADR 0064](../decisions/0064-video-is-made-with-remotion-in-the-repo-guidelines-are-the-leash-refreshed-weekly-by-pr.md).
- 2026-10-06 · **Weekend hours on screen:** Friday 10:00–15:00, Saturday 10:00 to sunset, as a
  dated seasonal fact in `FACTS.md` ("שעות סופי השבוע"); guidelines §1.2 now says a seasonal fact
  is cited with its date, re-confirmed at Gate 1, and a reel is not posted once its season has
  changed. The copy files cite the line.
- 2026-10-06 · **`VIDEO_GUIDELINES_PAT`:** the owner creates the fine-grained PAT (this repo only,
  Contents + Pull requests read/write) and stores it as the repo secret before the first scheduled
  run; the publish job already prefers it over `GITHUB_TOKEN` → ADR 0064 consequences.
- 2026-10-06 · **Testimonial review texts leave the public repo:** `video/public/private/reviews.json`
  (gitignored) is read by `loadReviews` (`calculateMetadata`) in Studio and at render; the repo
  holds `[חסר]` placeholders; guidelines §1.1 amended → ADR 0064 consequences.
- 2026-10-06 · **License headcount:** a company of one — no watch needed now; the clause stays in
  the guidelines and the weekly job re-reads the terms, which is enough.

- 2026-10-06 · **Remotion patch bumps keep auto-merging, and CI green must mean "it renders":**
  a follow-up Tier-A PR after #109 adds one still render to `ci.yml` when `video/` changes (one
  composition, one frame; Chrome Headless Shell downloaded in that run only). Carving `/video` out
  of auto-merge was rejected — a manual merge per Remotion release is the wrong trade for a company
  of one.

## Publish log

*(one line per posted reel: date · brief slug · language · hook variant · platform · hook rate
when read)*

## Close-out

*(appended when done — CLAUDE.md "Roadmap item close-out")*

## Outcome check

*(appended on the check date: metric value vs target, verdict, what it changes)*
