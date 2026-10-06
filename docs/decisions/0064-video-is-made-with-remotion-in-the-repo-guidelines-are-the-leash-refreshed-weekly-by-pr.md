# 0064 — Video is made with Remotion inside the repo; its guidelines are an agent instruction file, refreshed weekly by a research job that opens a PR the owner merges

- **Date:** 2026-10-06
- **Status:** accepted
- **Decided by:** owner (kickoff alignment, 2026-10-06) + Claude Code
- **Source:** the owner's request "We are going to start using Remotion inside our project" with a
  research document (2026-10-06); the eight alignment answers recorded in
  [plans/video-pipeline.md](../plans/video-pipeline.md)

## Context

Two reels were built on 2026-10-05 in a Remotion project kept outside this repo, because the
first cut scraped Google reviews with names. The project had no rules: safe zones from a popular
prompt, no pinned versions, reviewer names on screen. The owner's research (Sabrina Ramonov,
snapcn, Roboto Studio, the Remotion prompt showcase, HeyGen HyperFrames, the official
`remotion-dev/skills`) agrees that agent-made video is only as good as its brief, its kit and its
render-and-look loop, and that the practice moves monthly. Two existing rules shaped the answer:
agent instruction files are the leash, Tier A, never merged on green
([ADR 0036](0036-agent-instruction-files-are-the-leash.md)); and the report agents hold no network
write and may not read the web, because they read public issue text
([ADR 0048](0048-report-agents-hold-no-write-and-actions-are-sha-pinned.md)).

## Decision

1. **Remotion lives in this repo, at `video/`, and is never deployed.** It is a Node 22 project
   beside `app-src/`, type-checked and linted by `ci.yml`'s required job, absent from the assemble
   allowlist, its renders gitignored. The 2026-10-05 project migrates in under the public-repo
   rules: reviewer names become neutral labels, staff names never appear, no prices, facts from
   `FACTS.md`, raw media in the gitignored `media/` intake.
2. **`video/public/site/` is generated from `img/`, never committed.** The reels use the site's
   own photos, icons and hero clip; `npm run assets` copies them from `img/` by a map in code.
   Only derivatives that exist nowhere else (recoloured brand icons, one photo) are committed.
3. **The video guidelines are an agent instruction file:** `video/GUIDELINES.md`, in the leash
   class (ADR 0036, Tier A — named in `scripts/check-tier.mjs`). *Amended 2026-10-06:* the file
   first lived at `.claude/skills/new-video/guidelines.md`; the first acceptance run with a
   transcript showed the agent's Edit denied there, because Claude Code treats `.claude/` as a
   protected path no non-interactive agent may write under, so it moved beside the project. Every change to it is a PR a human reads — including the
   weekly job's. The file carries dated sources and a changelog; its "rules of the house" section
   (names, facts, languages, license, never deployed) is the owner's and no job edits it.
4. **The `new-video` skill builds the brief with the owner**, question by question, and writes it
   to `video/briefs/<slug>.md` as a complete prompt. The owner's approval of the storyboard is
   Gate 1; stills are Gate 2; the MP4 on a phone is Gate 3. The skill never renders the final
   file, commits, pushes or posts on its own.
5. **The weekly refresh is a separate worker, built the other way round from `agent-report.yml`:**
   it reads the web and edits one file, and reads no issues. The research job runs with
   `contents: read`, no `GH_TOKEN`, no persisted checkout credentials, `Write` and every write
   command denied; a fixed step refuses the run if any path but the guidelines changed and scans
   the diff for the OAuth token's value. A second job with no agent commits, pushes and opens the
   PR with its Tier line. Nothing merges without the owner. Web content is data: a page that tells
   the agent to do something is reported in the changelog, never followed.
6. **Scope decisions of the kickoff:** video is Q4 mandate item 15 (its own line, not item 6);
   Meta only this quarter (Reels, Stories, feed 4:5); no audio in v1 and no audio file without a
   license line; the official Remotion Agent Skills stay installed per machine, pinned by version
   in the guidelines; the free Remotion license applies at ≤ 3 people and is re-read weekly.

## Consequences

- A third npm project in the repo: `npm ci` + lint + tsc in CI on every run (~1–2 min), a
  `/video` dependabot entry with all `remotion` / `@remotion/*` packages grouped, since Remotion
  requires one exact version across them.
- The weekly PR is the owner's Monday read. Opened with `GITHUB_TOKEN` it starts no CI run, so
  the owner stores a fine-grained `VIDEO_GUIDELINES_PAT` (this repo only, contents + pull
  requests write; decided 2026-10-06) and the publish job opens the PR with it; without the
  secret it falls back to `GITHUB_TOKEN` and the owner closes-and-reopens.
- Review texts for the testimonial reel are not committed (owner, 2026-10-06): the composition
  reads the gitignored `video/public/private/reviews.json` through `calculateMetadata`; Studio
  shows `[חסר]` placeholders without it and a render fails. The texts are public Google reviews,
  so the copies that reached `staging`'s history (never force-pushed) are not a secret; the
  `video-pipeline` branch was rewritten to one commit before merge, so neither PR #109's commit
  list nor `main` carries them.
- The two existing reels were laid out on the looser 150 / 170 px zone; the guidelines say
  269 / 672 px (Meta). They stay as built for this week's renders and are re-laid out as the
  first follow-up — the reviewer checklist will flag them until then.
- The per-machine skills mean a `@claude` or CI run does not have them; the guidelines carry
  enough of their rules for a build to follow, and `npx skills update remotion-*` is the local
  refresh when the weekly PR reports a new version.
