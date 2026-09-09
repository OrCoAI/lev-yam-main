# 0006 — GA4 carries the hand-written whatsapp_click event; tier separation for GA is console-side, not code-side

- **Date:** 2026-08-11
- **Status:** accepted (reverses the earlier "GA4 carries no hand-written events" rule)
- **Decided by:** owner + Claude Code (kickoff of the `/stories/` build)
- **Source:** `CLAUDE.md` marketing "Analytics — three vendors, deliberately unequal scopes" bullet; `docs/plans/content-engine-phase0.md` decision P2

## Context

The marketing site sends analytics to three vendors with deliberately unequal scopes: Dynatrace
carries everything, Meta Pixel carries `Contact` on WhatsApp CTAs, and GA4 (`G-VWL45MKK76`,
added 2026-08-11) was originally to carry only Enhanced Measurement's automatic events. The
`/stories/` build added many pages whose success is measured by per-page CTA attribution, which
the automatic outbound `click` cannot provide. Separately, `staging.levyam.com` serves the same
`index.html` with the same measurement ID, raising the question of how to keep staging traffic
out of prod reports.

## Decision

Quoted from `CLAUDE.md`:

> `whatsapp_click` sits next to that as the named, per-page event and is the one marked as a key
> event in the GA4 UI. *(This reverses the original "GA4 carries no hand-written events" decision —
> reversed deliberately 2026-08-11 with the `/stories/` build, because per-page CTA attribution is
> what the story pages are measured by. Adding any **further** `gtag('event', …)` is still a
> deliberate decision, not a default.)*

> **Tier separation for GA is console-side, not code-side:** `staging.levyam.com` serves this exact
> `index.html` with the same measurement ID, so staging is excluded via an internal-traffic/hostname
> filter in GA → Admin. Don't "fix" that with a hostname guard in the snippet — a domain change
> would silently kill prod collection.

The content-engine plan records the same reversal as decision P2: "`CLAUDE.md` updated to record
the reversal."

## Consequences

- `js/wa-track.js` (`LevYamTrack.whatsappClick`) fans a CTA click out to all three vendors,
  with GA4 receiving `whatsapp_click` carrying `page_slug` from `<body data-page-slug>`.
- Enhanced Measurement stays ON; `whatsapp_click` is the single key event in the GA4 UI.
- Any additional `gtag('event', …)` needs its own decision and, from now on, its own ADR.
- No hostname guard goes into the GA snippet; staging exclusion lives in GA Admin only.
