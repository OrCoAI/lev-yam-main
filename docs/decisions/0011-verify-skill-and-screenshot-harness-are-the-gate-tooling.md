# 0011 — The verify project skill and scripts/verify/screenshot.mjs are the gate's harness; never hand-roll a Playwright/CDP script per session

- **Date:** 2026-08-12
- **Status:** accepted
- **Decided by:** owner + Claude Code (close-out)
- **Source:** `CLAUDE.md` "Pre-commit quality gate", step 3 (last sentence); `.claude/skills/verify/SKILL.md`

## Context

Gate step 3 (`/verify`) requires driving the affected flow end-to-end in a real browser on
localhost. For weeks each session wrote a fresh headless-Chrome/CDP or Playwright script to do
it. The verify skill records what that cost:

> Formalizes what used to be a fresh Playwright/CDP script hand-rolled every session (see the
> many `verify*.mjs` entries in `.claude/settings.json`'s permission history — this replaces
> that pattern).

Per-session scripts also drifted in what they checked: the topbar overflow (ADR 0009) was missed
partly because each ad-hoc script shot whatever viewports its author picked.

## Decision

Quoted from `CLAUDE.md` step 3:

> Backed by the `verify` project skill (`.claude/skills/verify/`) and
> `scripts/verify/screenshot.mjs` (decided 2026-08-12) — use them instead of hand-rolling a
> new Playwright/CDP script per session.

The skill defines the fixed procedure: serve the right surface (static via
`python3 -m http.server 8080`; platform via Node 22 + local Supabase stack + `npm run dev`,
with `?preview` for fixture-granted permissions), screenshot and click through with
`scripts/verify/screenshot.mjs` (Node 22, zero npm deps, raw CDP, own throwaway Chrome), read
the PNGs it writes, and for `supabase/` diffs run `rls_matrix.sql` to green on local or staging.
"Never point any of this at staging or prod — local only, per CLAUDE.md."

## Consequences

- One harness carries the accumulated gotchas (no `captureBeyondViewport` on RTL, the
  mobile-emulation overflow trap, three default viewports) so they are not relearned per session.
- Improvements to verification land in the script and the skill, where every later session
  inherits them; a new one-off script is a process deviation.
- Step zero of the gate (ADR 0008) uses the same script for its screenshots.
