# 0063 — Every story page tells a village story no other page tells

- **Date:** 2026-10-05
- **Status:** accepted — amends [ADR 0053](0053-story-pages-are-narrative-essays-village-facts-sourced-in-facts.md) ("one true story per page")
- **Decided by:** owner (pair 5 review, `strategy-offsite-by-the-sea`)
- **Source:** owner, 2026-10-05 — "create another village story - always generate new stories."

## Context

ADR 0053 made each story page a narrative essay carrying one true, sourced story of the place,
but did not say a story could not appear twice. The first draft of pair 5 retold the unfinished
aqueduct of Nahal Taninim, which `company-event-near-caesarea` already tells with the same
figures; the gate's code review flagged the overlap as near-duplicate content for search.

## Decision

1. A page's village story is **new to the site**: no live or drafted page tells it, not even as a
   passing sentence that the new page would expand.
2. Before drafting, the author lists which `FACTS.md` §הכפר facts the existing pages already
   carry and builds the story from facts no page uses.
3. When too few unused facts remain for a story, new facts are **researched and added to
   `FACTS.md` first**, with source and confidence (ADR 0053 §research) — never a reuse.
4. Venue facts (location, amenities, kitchen, booking) are not stories and may repeat across
   pages, as they must.

## Consequences

- Research load grows as the backlog advances: the twelve remaining pairs need twelve stories,
  and §הכפר's unused facts run short within a few pages — expect a `FACTS.md` research round
  (Tier B) before most later pairs.
- The `story-author` skill's step 1 should carry this check; amending it is a `.claude/` change
  (Tier A, own PR).
