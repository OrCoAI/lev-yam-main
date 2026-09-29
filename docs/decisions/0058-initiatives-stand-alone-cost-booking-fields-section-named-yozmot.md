# 0058 — An initiative's page stands alone (no link to a story pair), carries cost + booking as structured fields, and the public section is named "יוזמות" / "مبادرات"

- **Date:** 2026-09-29
- **Status:** accepted. Amends [0056](0056-whats-happening-item-pages-are-generated-landing-pages-rebuilt-on-publish.md) §7 (the optional "read the full story" link) and the PR 2 decisions table rows 5, 7 and 9 in [plans/events-whats-happening.md](../plans/events-whats-happening.md); 0056 otherwise stands.
- **Decided by:** owner, on the first localhost review of the landing page (PR #97, before the gate).
- **Source:** the owner's review notes, verbatim in the plan's "Decisions made on the way" (2026-09-29).

## Context

PR 2 was built from the kickoff table: a minimal header over the hero, two optional fields, an
optional link from an item to a `/stories/` pair (which also let a linked item publish without a
body of its own), and the section name "מה קורה" carried over from PR 1. On localhost the owner
reviewed the built page and asked for a different page: the full site header, a calendar on the
hub, a cost-and-booking tile entered at creation, no connection between initiatives and stories,
and the section renamed. Each is a rule the code enforces (a CHECK, a column, a nav label stamped
into every page), so each is recorded here rather than left in the diff.

## Decision

1. **No link between initiatives and stories.** `events.events.story_slug` and its format CHECK
   are dropped; `events.publishable()` requires the body in both languages for every public item
   (60_events_cost.sql). The landing page is the item's only detail page. Stories and initiatives
   share the site chrome (nav, footer) and nothing else. A public row that was publishable only
   through a story link is demoted to internal when 60 is applied, with a notice.
2. **Cost and booking are structured fields**, set when the item is created: `cost_he` / `cost_ar`
   (free text, optional, shown in both languages or in neither — the same CHECK as the other
   optional lines) and `booking_required` (a flag the page words as one fixed line per language).
   A cost line is not a price list: it is the item's own wording, and "no prices in the repo"
   ([story rules](../../CLAUDE.md)) still applies to everything the repo authors.
3. **The section is "יוזמות" / "مبادرات"** everywhere a visitor sees it: the nav entry on the
   homepage, every story page and both hubs, the hub title, the homepage strip, breadcrumbs, the
   404 page and `llms.txt`. The URL stays `/happening/`; the module key, the schema and the code
   keep their names. "مبادرات" is the Arabic the owner has not yet reviewed with a native reader —
   it goes on that pass with the CTA line.
4. **The hub carries a month calendar** rendered in the browser from the live feed (a recurring
   item is expanded day by day; nothing before today is marked); a marked day opens its items
   beside the month. The cards below stay the list a crawler, a no-JS reader or a failed fetch gets.
5. **The landing page's design** is the one the owner approved on localhost on 2026-09-29: the
   site header and zigzag, the hero, an action panel (CTA + share row) beside the fact tiles
   (when / where / cost & booking / who / what to bring, each with a brand mark), the text, an
   automatic 3-second crossfade of the photos, getting-here, about, and "יוזמות נוספות" last.
   Only the brand's own marks are used (the four icons and the logo stamp).

## Consequences

- `60_events_cost.sql` is a Tier-A schema change that **drops a column**: it is hand-applied on
  staging before the staging round and on prod before the merge (the plan's owner setup), and
  any `story_slug` value entered on either tier before that is lost by design.
- The events form loses the "link to a story" field and gains the cost pair and the booking
  switch; `translate` covers the cost text.
- The plan's row 4 order ("also coming up" before getting-here) and row 7 ("minimal header") are
  superseded by 5 above.
