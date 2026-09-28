# 0054 — "What's happening" shows the venue's public life, is published from /app, and refuses a public row without Arabic

- **Date:** 2026-09-25
- **Status:** accepted. It widens the scope of Q4 mandate item 8 in [0046](0046-q4-2026-mandate-marketing-quarter.md), which the mandate called "minimal: events table + one page". It extends the events spine ([plans/cross-module-foundation.md](../plans/cross-module-foundation.md)).
- **Decided by:** owner (kickoff alignment, [plans/events-whats-happening.md](../plans/events-whats-happening.md))
- **Source:** the owner's kickoff answers, 2026-09-25: *"Weekends + community + I want the ability to add
  initiatives constantly: only things that are happening live will be in this page and an explanation
  page with all the information with cta will be added to each item in the general page."* On how
  items are added: *"Both."*

## Context

The mandate called item 8 minimal: an events table plus one public HE/AR page that reads Supabase
anonymously. It also set the quarter's positioning: "focus on private and business events". Those
events can never be public, because quote-sourced event titles carry customer names. So the mandate
line and the positioning pulled in different directions, and the events spine had no Arabic field
and no staff screen.

## Decision

1. **Content: the venue's public life, live items only.** The page shows weekend events, community
   activities, workshops and team-published initiatives. An item leaves the page on its own once its
   date, or the end of its recurrence, has passed. Private and business events stay on the homepage
   and in the stories. This page complements the positioning; it does not replace it.
2. **Two kinds of item:** dated and recurring (weekdays and hours, with an optional end date).
3. **Two ways to publish:**
   - a form in `/app/events`, gated by `events.manage` (owner and manager), which goes live with no PR;
   - a static story-style HE + AR pair for the major recurring items. The DB item then links to that
     page.
4. **One detail page per item** with a prefilled per-item WhatsApp CTA and `Event` JSON-LD. Neither
   ever carries a price.
5. **Arabic is enforced in Postgres.** A CHECK constraint refuses `visibility = 'public'` unless every
   HE and AR text field is filled, and another refuses to make a quote-sourced row public. The form's
   disabled button is a convenience, as with every UI gate here (invariant 1).

## Consequences

- This is the first public content table. The public site reads the platform's Supabase project for
  the first time, so the static site needs the platform URL and anon key per tier.
- The `events` schema is exposed to the API, and the `events` module tile goes live.
- DB-rendered detail pages are indexed less reliably than static pages. That is why the static path
  exists; per-item sitemap entries wait for the first outcome read.
- Phase 3 member initiatives will publish into the same table, so no second public surface is built
  later.
