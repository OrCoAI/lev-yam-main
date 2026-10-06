# video/ — Lev Yam reels (Remotion)

Short videos for Instagram / Facebook, made with [Remotion](https://www.remotion.dev). **Never
deployed** — nothing here reaches levyam.com; CI only lints and type-checks it. Plan:
[docs/plans/video-pipeline.md](../docs/plans/video-pipeline.md); decision: ADR 0064; **the rules:
[.claude/skills/new-video/guidelines.md](../.claude/skills/new-video/guidelines.md)**.

```
npm ci                 # Node 22 (.node-version); first render also downloads Chrome headless shell
npm run dev            # sync assets from ../img, then Remotion Studio (http://localhost:3000)
npm run review -- WeekendReel-he            # review stills → out/review/<id>/*.png
npm run render -- WeekendReel-he out/WeekendReel-he.mp4
npm run lint           # eslint + tsc (what CI runs)
```

- `src/levyam/` — the brand kit: `theme.ts` (colours, type, safe zones), `parts.tsx` (Words,
  Bidi, KenBurns, Scrim, Pill…), `transitions/` (the five brand cuts), `SafeZone.tsx` (Studio guide).
- `src/copy/<lang>.ts` — every word on screen; a new reel is new copy, not new markup.
- `public/site/` — **generated** from `../img` by `scripts/sync-assets.mjs` (gitignored).
  `public/brand/`, `public/photos/` — committed derivatives that exist nowhere else.
- `briefs/` — one prompt per reel, written by the `new-video` skill with the owner.
- `out/` — renders and review stills (gitignored).

A reel starts as a brief (`/new-video`), gets built in Studio, is reviewed as stills (Gate 2), and
is rendered only when the owner asks. Both languages before anything is posted.
