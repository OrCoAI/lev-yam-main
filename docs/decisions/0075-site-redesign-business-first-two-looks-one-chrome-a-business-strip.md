# 0075 — The site redesign enters the Q4 mandate as item 1a: business events lead, the business page lives at `/business/`, each page keeps its own look, and story and initiative pages carry one business strip

- **Date:** 2026-11-23
- **Status:** accepted — amends the Q4 mandate in [ROADMAP.md](../ROADMAP.md) (a new item 1a);
  amends [0050](0050-story-pages-carry-no-body-links.md) (its "decide the form as its own
  decision" clause is used here) and §1 of [0058](0058-initiatives-stand-alone-cost-booking-fields-section-named-yozmot.md)
  ("share the site chrome and nothing else" — the chrome gains one line); both otherwise stand.
  Number 0074 is held by a decision drafted on another branch. Amended by
  [0076](0076-one-shared-site-chrome-business-page-events-map-key-and-retired-subdomains.md)
  (the redirect's form).
- **Decided by:** owner + Claude Code (kickoff of [plans/site-redesign-business-first.md](../plans/site-redesign-business-first.md))
- **Source:** the owner's request and the `feature-spec` alignment questions, 2026-11-23, in session

## Context

The owner asked to redesign levyam.com: in the homepage section "מה קורה בלב ים", business
events should be bold and the other services secondary, and its link should lead to the
business page — until now a separate site at `b2b.levyam.com` in its own repo
(`OrCoAI/lev-yam-b2b`), which the owner asked to merge into this one.

The redesign was not a line in the Q4 mandate. The roadmap decides order, so adding it is a
decision, not a default — and it was raised with the posting backlog in view (Marketing report
2026-W47: 0 of 10 reels with the deadline on 2026-11-30).

## Decision

1. **The redesign is item 1a of the Q4 mandate**, placed after item 1, nothing renumbered, and
   starts now (owner: "Add to Q4 now").
2. **The business page lives at `levyam.com/business/`**, built from this repo. `b2b.levyam.com`
   stays alive as a redirect, so links already sent keep working.
3. **One spec covers the whole homepage** (owner: "Whole homepage at once"), shipped as two PRs.
4. **Each of the two keeps its own styling** — the homepage its blue bands, the business page
   its cream — and the design's job is balance and a smooth transition between them (owner's
   words: "each one of the two keeps it's own styling - your call is to make it balance and
   smooth transition"). The shared parts are the header structure, the stamp, the button
   shapes, the type scale and the wave divider.
5. **Story pages and `/happening/` pages carry one business strip** — a single quiet line
   linking to `/business/`, in the generated chrome above the footer, never in the body text.
   It is the same line on every page, stamped from the templates.
6. **The WhatsApp planner serves the whole site**: it replaces the homepage's four contact
   buttons and its first question covers every audience, not only business (owner: "the
   planner should be relevant for the full levyam.com page").
7. **The outcome metric** is `whatsapp_click` from `/business/` per week plus the homepage's
   click-through to it, checked three weeks after ship.
8. **What never crosses from `lev-yam-b2b`:** its legacy price list, its private business
   documents, its worker and its environment file.

## Consequences

- The business page becomes visible to GA4, Meta Pixel and the weekly marketing report for the
  first time; its WhatsApp clicks go through `js/wa-track.js` like every other page's.
- The site deliberately shows two looks. A later wish for one look is a new decision, not a
  drift inside a PR.
- The business strip is the one sanctioned cross-link out of a story or initiative page. A
  second one needs its own decision; ADR 0050's rule against body links is unchanged.
- The homepage still shows no strip of initiatives (0058 §3 stands).
- The business page's Arabic, marked draft in its old repo, needs the owner's reader pass
  before it ships here (invariant 5, ADR 0069).
- The proof section (testimonials, logos, facts strip) is out of this spec and waits for the
  owner's content and consent.
