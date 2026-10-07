---
name: new-video
description: >
  Build the complete prompt for one new reel WITH the owner — closed questions one at a time
  (type, audience, the single CTA, format, length, languages, two hook variants, the shot list,
  assets, facts) — then write it to video/briefs/<slug>.md and, on approval, run it: build the
  composition in video/ with the Remotion skills, render review stills, stop at the owner's gates.
  Triggers: "new video", "new reel", "make a reel", "video for", "reel for the weekend",
  "promo video", "סרטון חדש", "ריל", "/new-video run <slug>". Not for editing the website's hero
  video or story-page videos.
metadata:
  version: '0.1.0'
---

# New video

Turns an owner's idea into a brief that is a complete, self-contained prompt, and then into a
reviewed composition. The rules are [video/GUIDELINES.md](../../../video/GUIDELINES.md) — read it in full first, every
time; this skill adds procedure only. Plan: `docs/plans/video-pipeline.md`; decision: ADR 0064.

**The skill never:** renders the final MP4 unasked, commits, pushes, posts, invents a fact, types
a price, or puts a reviewer's or staff member's name on screen.

## Modes

- **`/new-video`** (or any trigger with an idea): the interview → the brief → Gate 1 → one closed
  question: run now or later.
- **`/new-video run <slug>`**: an approved brief exists in `video/briefs/<slug>.md` → build it
  (step 4 onward).

## 1. Read, don't recall

`video/GUIDELINES.md` (all sections), `FACTS.md`, the `/happening/` page the reel is about (if any,
read today — `happening/` shells or the live `levyam.com/happening/<slug>/`), every existing
`video/briefs/*.md` (to refuse a near-duplicate and reuse a proven shot list), `video/src/Root.tsx`
(what compositions and variants exist), `video/src/copy/*.ts` (the copy conventions), and
`video/src/levyam/theme.ts` + `parts.tsx` (the kit the brief composes from).

## 2. The interview — closed questions, one at a time (AskUserQuestion)

Ask only what the idea left open; propose the guideline's default as the first option and mark it
"(Recommended)". Stop when the brief can be written without a guess.

1. **Type** — event / initiative promo · weekend open house · recap of real footage · testimonial
   (public reviews, neutral names) · ambient loop · "this week at Lev Yam".
2. **Audience + the one ask** — who scrolls past this, and the single CTA in words (WhatsApp
   message · the page URL · "come Friday"). One CTA, never two.
3. **Format and length** — 9:16 Reels/Stories (default) · + 4:5 feed re-layout; 6–15 s cold
   reach (default) · 15–30 s consideration · ≤ 15 s ambient loop.
4. **Languages** — HE + AR (default, required before posting) · HE first with AR to follow in
   the same brief (allowed only as a staging order, never as a release).
5. **Two hooks** — pick two openings for the first ~3 s from: the name leads · the days/date
   lead · a question · the strongest footage with no text for 0.5 s · a giant numeral
   (countdown). The rest of the reel is identical across hooks.
6. **Shots** — propose a numbered shot list from the type's pattern in
   [brief-template.md](brief-template.md) (seconds, exact copy per language, the asset, the
   kit motion); the owner edits line by line. Every on-screen fact names its `FACTS.md` line or
   the page it came from; a missing fact becomes `[חסר: …]` / `[مفقود: …]`.
7. **Assets** — list candidates by path from `img/` (via `video/public/site/`), the committed
   `video/public/brand|photos/`, and the gitignored `media/` intake; the owner picks. Nothing
   outside those three sources.
8. **Out of scope for this reel** — what a reader might assume is in (sound, English, a second
   CTA, a price) and is not.

Anything that would change a rule in `video/GUIDELINES.md` is raised, not coded around — the conflict
rule in `CLAUDE.md`.

## 3. Write the brief, then Gate 1

`video/briefs/<slug>.md` from [brief-template.md](brief-template.md) — English kebab-case slug,
unique. Fill every section; the "Shots" table carries seconds, frame counts at 30 fps, the exact
HE and AR copy (AR lines marked `[ar-draft]` until signed off), the asset path, the kit parts and
transition by name, and the hook variants as separate first rows. The "Acceptance" section is the
reviewer's checklist for *this* reel. The "Render matrix" lists every composition id to render.

Show the owner the storyboard — one line per shot — and ask **Gate 1** as a closed question:
approve · edit a shot (say which) · start over. Then one more closed question: **run it now in
this session, or later** (`/new-video run <slug>`). Either way the brief file is left in the tree
for the gate and the PR; this skill does not commit.

## 4. Build (run mode)

1. `cd video && npm ci` if needed; **open Studio first** — `npm run dev` (keep it open; the owner
   watches and steers). Load the `remotion-best-practices` skill and let it route
   (`remotion-markup`, `remotion-create`); for any API, the `remotion-docs` skill over memory.
2. Copy: add the reel's entry to `video/src/copy/he.ts` and `ar.ts` (or a new schema +
   copy file for a new type) — every word on screen comes from there.
3. Markup: compose the beats from the kit (`parts.tsx`, `theme.ts`, `transitions/`); a part the
   kit lacks is added to the kit, not written inside the scene. Register one `<Composition>` per
   (language × hook) with inline `defaultProps`, grouped in a `<Folder>`; `<SafeZone />` as the
   last child of the root.
4. `npm run lint` clean.

## 5. Review, then Gate 2

`npm run review -- <id> [<id> …] --guide` for every composition in the matrix (frames 0, 15,
mid, end-30; one bundle and one browser for all of them; `--guide` adds a still per frame with
the safe-zone overlay) — this is also what the gate's `verify` step does for a `video/` diff —
then run the reviewer from [review.md](review.md) **as a subagent with a clean context** on the
PNGs. Fix every FAIL, re-render, re-run until the table is all PASS; a FAIL the guidelines list
as a known exception is reported, not fixed. Then give the owner the stills'
paths and ask **Gate 2** as a closed question. The final MP4 (`npm run render`) and the cover
still are rendered only after the owner says so; Gate 3 is the MP4 on their phone, and posting is
theirs.

## 6. Hand-off

List what changed (brief, copy, markup, kit), the commands to see it (`npm run dev` → the
composition ids; `out/review/<id>/`), and the Arabic lines still marked `[ar-draft]`. The
pre-commit gate and the Tier-B PR for `video/` follow `CLAUDE.md` as for any diff; the plan's
publish log gets its line when the owner posts.
