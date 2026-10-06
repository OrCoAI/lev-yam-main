# Reviewer — look at the stills, not the code

Run as a **subagent with a clean context** (CLAUDE.md "Session hygiene"): a builder reviewing its
own frames re-reads its intent, not the picture. The reviewer edits nothing.

## Input

- The brief: `video/briefs/<slug>.md` (its Facts table, Shots table and Acceptance list).
- The stills: `video/out/review/<id>/*.png` for every composition in the render matrix, from
  `npm run review -- <id> [<id> …] --guide` (frames 0, 15, mid, end-30 by default; add
  `--frames` for any shot boundary the brief names). `--guide` writes a `<frame>-guide.png` beside
  each plain still with the safe-zone overlay drawn: judge check 1 on the guide still, everything
  else on the plain one.
- `.claude/skills/new-video/guidelines.md` §3–§7.

## Prompt

```
You are the video reviewer for Lev Yam. Do not edit code. Open every PNG under
video/out/review/<id>/ for the compositions listed in video/briefs/<slug>.md and check each frame:

1. Safe zone — key text and the end-card ask inside the text zone and clear of the platform
   bands: `ZONE` and `META` in video/src/levyam/theme.ts, the rule in guidelines §3.
2. Type — the minimums in guidelines §4 (estimate from the frame).
3. Right-to-left — reading order right to left in both languages; digits, times and URLs
   left-to-right inside the line; Arabic letters joined (no disconnected glyphs), no letter-spacing,
   no outline stroke.
4. Scenes — no two beats visible at once (no stacked crossfade); the hook frame (frame 0 / 15)
   has footage up and a word in; no logo or wordmark before the end card.
5. Contrast — text readable on the photo (scrim present where needed).
6. Copy — every word matches video/src/copy/<lang>.ts and the brief's Shots table; spelling.
7. Facts — every fact, URL and number matches the brief's Facts table; no price; no personal
   name; nothing the brief does not list.
8. End card — the ask in words, held still for the last ≥ 1.5 s (end-30 frame = settled).
9. Hooks — variants differ only in the first beat.

Output one table: | composition | frame | check | PASS/FAIL | what is wrong | the fix |
followed by a one-line verdict per composition. A missing still is a FAIL for that frame.
```

## After the review

The builder fixes every FAIL, re-runs `npm run review`, and re-runs the reviewer until the table is
all PASS — except a FAIL the guidelines list as a known exception (today: §3's two 2026-10-05 reels
on the older safe zone), which is reported with that pointer and left for its follow-up. Only then
does the owner see the stills (Gate 2).
