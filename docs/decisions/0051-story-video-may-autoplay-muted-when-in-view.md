# 0051 — A story video may autoplay muted once it scrolls into view

- **Date:** 2026-09-23
- **Status:** accepted — amends the story video block of [plans/content-engine-phase0.md](../plans/content-engine-phase0.md) ("loads nothing until tapped")
- **Decided by:** owner (localhost review of the first cornerstone pair, `team-day-by-the-sea`)
- **Source:** owner's review of the draft on localhost, 2026-09-23 — "make the video start automatically"

## Context

The Phase 0 story template made the video strictly tap-to-play: `preload="none"`, nothing
downloaded until the reader asks for it — mobile data and page weight first. On the first real
page the video is a short montage of the day (a talk, yoga, football, the food), and the owner
wants it moving without a tap: a still poster reads as one more photo.

## Decision

A story video **may** carry `muted loop data-autoplay`. `js/stories.js` then plays it — muted,
looping — only while at least 40% of it is on screen, and pauses it when it leaves.
`preload="none"` stays, so nothing but the poster is fetched until the reader scrolls to it.
No autoplay for `prefers-reduced-motion: reduce` or save-data (`navigator.connection.saveData`),
without JS, or after the reader pauses it themselves (until they press play again); a pause the
browser makes while the tab is hidden does not count as the reader's; the controls stay so it can always be stopped. Tap-to-play remains the default —
autoplay is a per-page opt-in.

## Consequences

- A reader who scrolls to the video downloads it (≤8MB rule unchanged) without asking; one who
  never reaches it pays only the poster.
- The video carries no sound by construction (the montage is encoded with `-an`), so muted
  autoplay loses nothing.
- Hero video stays out of scope: the hero is the LCP image and remains a still.
