---
name: verify
description: "Drive the pending diff's affected flow end-to-end on localhost — the gate's step 3. Serves the right surface, screenshots/clicks through it via headless Chrome, and (for supabase/ diffs) runs the RLS matrix."
---

# /verify

Backs the pre-commit gate's step 3 in `CLAUDE.md` ("drive the affected flow end-to-end in
the real app, not just typecheck/build"). Formalizes what used to be a fresh Playwright/CDP
script hand-rolled every session (see the many `verify*.mjs` entries in
`.claude/settings.json`'s permission history — this replaces that pattern).

Skip entirely for diffs with no runtime surface (docs-only), per CLAUDE.md's diff-class
scaling.

## 1. Serve the affected surface

- **Static** (marketing `index.html`, `/stories/`, `pos.html`, `survey-june.html`):
  `python3 -m http.server 8080` from the repo root.
- **Platform** (`/app`): needs **Node 22**
  (`/opt/homebrew/opt/node@22/bin/node` — the repo's default `node` is 20.11.1 and Vite 8
  requires 22) and the **local Supabase stack** running first: `supabase start && supabase
  db reset`. Then `cd app-src && npm run dev` → `localhost:5173/app`. Seed logins are in
  `supabase/seed.sql`.
  - Append `?preview` to skip login entirely — it renders whatever `permissionsFixture` in
    `app-src/src/dev/fixtures.ts` grants. A surface gated by a permission not yet in that
    fixture stays invisible under `?preview` — add it there first, or log in for real.

Never point any of this at staging or prod — local only, per CLAUDE.md.

## 2. Screenshot / click through

`scripts/verify/screenshot.mjs` — Node 22, zero npm deps (raw Chrome DevTools Protocol over
the platform's global `WebSocket`). It spawns its own headless Chrome on a random debug port
with a throwaway profile dir and tears it down after, so it never collides with a Chrome you
already have open.

```
node scripts/verify/screenshot.mjs <url> <outPrefix> \
  [--viewport mobile|desktop|both] [--js "<expr>"] [--wait ms] [--scale n]
```

- Defaults to **both** viewports (390px mobile, 1280px desktop) — mobile-first is a platform
  requirement, and `.rowline`-style disclosure UI behaves differently under 640px. Don't
  narrow to one viewport unless the diff is provably desktop- or mobile-only.
- `--js` runs just before the capture and may return a Promise (it's awaited) — use it to
  click a button, fill a field, toggle language, or wait on async-rendered content.
- Deliberately never uses `captureBeyondViewport` — on these RTL pages that shifts the
  image and reads as an overflow bug that isn't real. To check *actual* overflow, use
  `--js` to compare `document.documentElement.scrollWidth` against `clientWidth`.
- **Read the PNGs it writes** (the Read tool renders images) — a screenshot nobody looked
  at didn't verify anything.

## 3. RLS matrix — `supabase/` diffs only

Run `supabase/tests/rls_matrix.sql` to a green `RLS MATRIX: ALL ASSERTIONS PASSED`. It's
transaction-wrapped and rolls itself back, but still run it against the **local** stack (or
staging), never prod directly — extend it first with assertions for whatever the diff added
or changed.

## Gotchas

- Requires Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
- If a screenshot doesn't look like the change you made, check the served HTML/response
  first — don't assume the capture tooling is at fault before ruling out a stale dev
  server, a cache, or the wrong port.
