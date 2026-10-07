# 0065 — The roadmap keeps history as one line per item; the Q4 mandate's eleven open lines are merged into five

- **Date:** 2026-10-07
- **Status:** accepted — amends the list in [0046](0046-q4-2026-mandate-marketing-quarter.md) (merges, no new scope, nothing cancelled); extends [0045](0045-observability-home-re-deferred-to-2027-01-review.md)'s re-check list
- **Decided by:** owner (roadmap consolidation session, 2026-10-07) + Claude Code
- **Source:** the session's consolidation review of `docs/ROADMAP.md`; owner's picks: "hygiene pass + mandate merge", items 12/13 → parking lot, item 11 → item 2

## Context

`docs/ROADMAP.md` had grown to 742 lines, about 470 of them ticked history whose detail already
lives in plan-file close-outs. `session-start` reads the whole file every session. The live work
was one block plus open lines scattered across five places, with duplicates (the marketing
parallel track restated mandate item 2; Steps 9–11's unblocked halves were listed twice; one
secret deletion appeared twice), stale lines (staging follow-ups already done; the `pos.html`
"untouched until cut-over" sentence), and deferrals to the 2027-01-01 review spread over six spots,
three of them missing from ADR 0045's list.

The Q4 mandate had 15 lines, 4 done and 11 open, about twelve weeks left, and several lines that act on the
same pages or the same pipeline.

## Decision

**Roadmap shape.** Closed blocks collapse to one line per shipped item with its plan link. Open
work lives in exactly four places: the current block; *ordinary items* under the closed history,
grouped by the PR they ship in; **Parked until a trigger** (each line names what un-parks it); and
**The 2027-01-01 quarterly review** (a summary pointing at ADR 0045). The marketing parallel track
is dissolved — its open lines were mandate item 2, the "out this quarter" line, the review list, or
parked lines.

**Mandate merges** (numbers kept so references resolve; nothing is cancelled):

| Was | Now | Why |
|---|---|---|
| 3 Local SEO + 4 AEO layer | **3. Search & AI visibility** | markup and answer-first content on the same pages |
| 5 CTA sharpening | sub-line of **2** | a story-template change |
| 11 Content automation | sub-line of **2** | already pulled forward by [0052](0052-stories-four-pairs-a-week-for-the-first-month.md) as the means to the cadence |
| 6 Social pipeline | sub-line of **15** ("Social publishing") | posts and reels share one rhythm and one outcome |
| 12 Platform modules as MCP, 13 Harness smalls | `docs/ideas.md` parking lot | not marketing work; the monthly batch decides |

Merged sub-lines keep their own kickoff session and Outcome metric (ADR 0019) — a merge groups
the tracking, it does not merge initiatives into one spec.

**ADR 0045's re-check list gains three lines** that were tracked only on the roadmap: rotate
`GOOGLE_SA_KEY` (and delete `ANTHROPIC_API_KEY`) with the token regeneration; the dead Dynatrace
RUM tag on the marketing site; the first real run of the skill evals.

## Consequences

- The open mandate is five top-level lines — 2, 3, 7, 9, 10 — with 5, 6 and 11 continuing as
  sub-lines of 2 and 15.
- A new closed item is added as one line with its plan link; its story goes in the plan's close-out.
- The 2027-01-01 review judges the mandate on the original items' outcomes, read through these merges.
