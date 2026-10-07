# 0067 — The Q4 mandate is renumbered to match its order; old numbers stay readable through a mapping

- **Date:** 2026-10-07
- **Status:** accepted — reverses the "numbers are kept" rule of [0065](0065-roadmap-consolidated-q4-mandate-merged-to-five-lines.md) and [0066](0066-q4-mandate-order-content-media-first-items-16-to-18.md); the order of 0066 is unchanged
- **Decided by:** owner (roadmap session, 2026-10-07)
- **Source:** owner, after the order was merged: "change the numbers of the items to the updated numbering"

## Context

ADRs 0065 and 0066 kept the original mandate numbers as IDs so that plans, ADRs, workflow comments
and session notes that say "item 2" or "item 11" would still resolve. That left the roadmap reading
"1st — 18., 2nd — 17., …", a list where the number and the rank disagree.

## Decision

The open mandate items are numbered **1–8 in the order of 0066**. Each line carries *(was N)*, and
the block ends with an old → new mapping:

| New | Item | Was |
|---|---|---|
| 1 | Content & media optimization | 18 |
| 2 | Weekly marketing report (incl. social publishing) | 17 (+ 6) |
| 3 | Search & AI visibility | 3 + 4 |
| 4 | Story pages (incl. CTA sharpening, content automation) | 2 (+ 5, 11) |
| 5 | Google Business Profile loop | 7 |
| 6 | Backlink programme | 9 |
| 7 | Connect social + GBP to Claude | 16 |
| 8 | Paid test | 10 |

Done items lose their number in the list and keep *(was N)*: analytics wiring 1, What's happening 8,
report agents 14, video pipeline 15.

**Documents dated before 2026-10-07 keep the old numbers.** They are history and are not rewritten,
including code comments in `agent-report.yml`, `video-guidelines-refresh.yml`, `report-guard.py` and
`analytics-snapshot.mjs`. The mapping is how they resolve.

## Consequences

- A new reference to a mandate item uses the new number.
- A future reorder renumbers again only by the owner's decision, with the same *(was N)* +
  mapping treatment.
