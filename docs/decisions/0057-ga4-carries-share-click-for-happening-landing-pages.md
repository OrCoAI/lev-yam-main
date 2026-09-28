# 0057 — GA4 carries a second hand-written event, `share_click`, for the "What's happening" landing pages

- **Date:** 2026-09-28
- **Status:** accepted. A deliberate exception to [0006](0006-ga4-carries-whatsapp-click-tier-separation-console-side.md) ("adding any further `gtag('event', …)` is a deliberate decision, not a default"); 0006 otherwise stands.
- **Decided by:** owner (PR 2 kickoff, question 10, [plans/events-whats-happening.md](../plans/events-whats-happening.md))
- **Source:** the owner chose "GA4 too" over "Dynatrace only" and "not at all".

## Context

ADR 0006 keeps GA4's hand-written events to one, `whatsapp_click`, so that the GA4 property stays
a clean per-page CTA report and every other intent signal goes to Dynatrace alone. The landing pages
exist to be shared ([0056](0056-whats-happening-item-pages-are-generated-landing-pages-rebuilt-on-publish.md)),
and a share is an outcome in its own right: it is the step before the WhatsApp click for most of
the people the page will reach. GA4 is where the weekly review reads outcomes
([0047](0047-analytics-wiring-ga4-and-gsc-only-public-numbers.md)); a Dynatrace-only count would sit
outside that loop.

## Decision

- `js/wa-track.js` gains `LevYamTrack.shareClick({ channel, lang })`, which sends Dynatrace
  `levyam.share` (`event.channel`, `event.lang`, `event.page_slug`) **and** GA4 `share_click`
  (`page_slug`, `channel` ∈ `whatsapp | copy | native | qr`, `lang`). No Meta Pixel event.
- `share_click` is **not** a key event in the GA4 UI; `whatsapp_click` stays the one key event.
- The plan's Outcome metric table gains a "shares" row, reported as a first read with no pass line.
- Tier separation stays console-side (0006): no hostname guard in the snippet.

## Consequences

- GA4 now has two hand-written events. The rule of 0006 is unchanged: a third is again a
  deliberate decision with its own ADR, not a default.
- `CLAUDE.md`'s analytics bullet is updated with the second event when PR 2 ships.
