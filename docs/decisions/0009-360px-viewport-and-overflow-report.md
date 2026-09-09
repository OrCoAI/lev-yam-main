# 0009 — 360px joins the default screenshot viewport set and every shot reports horizontal overflow

- **Date:** 2026-08-12
- **Status:** accepted (amends ADR 0008)
- **Decided by:** owner + Claude Code (close-out)
- **Source:** `CLAUDE.md` step-zero item 1; `docs/ROADMAP.md` "The topbar overflows below ~370px" entry; `docs/plans/phase1-closeout.md` §C

## Context

The platform topbar overflowed at phone widths below ~370px for five weeks while every gate
screenshot passed clean. The screenshot helper shot 390px and 1280px only. From the roadmap:

> **Root cause of the five-week miss:** `screenshot.mjs` shot 390px only, and 390 is
> exactly the width it fit at. 360 is now in the default set, and every shot reports
> horizontal overflow automatically

The actual layout bug was structural (`.topbar-right` had no `flex-wrap`), but the process
bug was that the verification could not see it.

## Decision

The default viewport set gains a narrow 360px shot, and horizontal overflow is measured and
reported on every capture rather than eyeballed. From `CLAUDE.md` step zero:

> 1. Claude verifies the change visually first with headless-Chrome screenshots at both
>    viewports (360px narrow + 390px mobile + 1280px desktop; see the screenshot workflow
>    notes). The helper also reports horizontal overflow per viewport — a
>    `!! HORIZONTAL OVERFLOW` line is a finding, not noise. 360px joined the default set on
>    2026-08-12: the topbar overflowed there for five weeks while every gate screenshot passed
>    clean, because 390 is *exactly* the width it fit at.

## Consequences

- `scripts/verify/screenshot.mjs` defaults to all three viewports (`--viewport both`) and
  prints `!! HORIZONTAL OVERFLOW` per viewport; narrowing to one viewport needs a reason.
- The overflow check compares against the configured width, because under mobile emulation
  `window.innerWidth` grows to fit overflowing content and the naive check never fires; the
  verify skill tells sessions not to hand-roll a `--js` overflow check.
- An overflow line is a gate finding to fix, not output to skip past.
- The roadmap keeps the wrong original diagnosis on record so the history is not rewritten.
