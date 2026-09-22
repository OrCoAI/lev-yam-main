# 0046 — Phase 2 mandate for 2026-Q4: the marketing quarter — every effort goes to reaching the world, measured first

- **Date:** 2026-09-22
- **Status:** accepted — the Phase 2 mandate required by [0021](0021-operating-cadence-quarterly-gate.md); does not amend the vision ([0043](0043-q3-2026-review-vision-and-invariants-hold.md) holds every principle)
- **Decided by:** owner (first quarterly review, agenda items 4–5, [issue #62](https://github.com/OrCoAI/lev-yam-main/issues/62))
- **Source:** the sanctioned divergent brainstorm (18 candidates) and the owner's converge picks, in session

## Context

The first quarterly review is the gate into Phase 2, and its output "is the mandate for Phase 2"
(ADR 0021). The roadmap's Phase 2 as written is *bookings & events*. The owner's judgment at the
vision audit was a priority statement, not a principle change:

> Marketing Lev Yam to the world is highest priority this quarter.
>
> All the effort should be to marketing lev yam, we need to work on SEO AEO and every aspect of
> marketing should be in focus for this quarter.

P1 (community as creators) **holds as the purpose**; the sequencing puts the Join circle — being
found, understood and contacted — before Create. The roadmap's *bookings & events* Phase 2 is not
cancelled: its public half (the "What's happening" feed) is in this mandate; its internal half
(reservation CRUD, calendar) waits.

## Decision

### Positioning (this quarter's emphasis, not a standing rule)

> Focus on private and business events — we want a lot of focus on the venue and what it gives to people.

Every content piece this quarter leads with what the venue gives a group — a private dinner, a
company day, a family event — and the community story supports it. (Owner chose a mandate line, not
an ADR-level rule; revisit at the next review.)

### The mandate — in order (the owner edits the order in the PR if it is wrong)

Initiative #1 runs first because the operating system now requires every initiative to name an
outcome metric with a check date ([ADR 0019](0019-outcome-metrics-validation-loop.md)); without a
measurement source none of the others can be validated.

| # | Initiative | Outcome it moves | Brainstorm ids |
|---|---|---|---|
| 1 | **Analytics wiring** — GA4 `whatsapp_click` as a key event, Search Console, Ahrefs/Semrush (connected as MCP) feeding the `weekly-review` analytics headline | every other outcome becomes measurable; the weekly report's "Analytics headline" stops saying n/a | 14 |
| 2 | **Story pages at cadence + the authoring tool** — a story pair (HE + AR) from a brief with chrome, twin, hub and sitemap handled; `FACTS.md` gaps filled as pages need them | organic sessions and `whatsapp_click` by `page_slug` | 1, 17, 7 |
| 3 | **Local SEO cluster** — near Caesarea / Hadera / Jisr, directions, "things to do", fish-restaurant intents | local-pack impressions, direction requests | 2 |
| 4 | **AEO layer** — `facts.txt` / `llms.txt` expansion, `FAQPage` + `Event` JSON-LD, answer-first blocks; measured with Ahrefs Brand Radar | citations and mentions in AI answers | 6 |
| 5 | **CTA sharpening** — per-page prefilled WhatsApp messages, click-to-call, sticky CTA on stories | click-through rate per page | 12 |
| 6 | **Social pipeline** — every story yields IG/FB posts; Meta Pixel `Contact` already fires | social-referred WhatsApp clicks | 10 |
| 7 | **Google Business Profile loop** — posts, photos, review replies, Q&A; `AggregateRating` on site | GBP calls and direction requests | 5 |
| 8 | **Public "What's happening"** — Phase 2's public events page, minimal: events table + one HE/AR public page reading Supabase anonymously (the first public content table — P4 gets tested) | event inquiries | 8 |
| 9 | **Backlink programme** — tourism, food/travel, Arab-society media | referring domains (Ahrefs DR) | 4 |
| 10 | **Paid test** — a small Meta/Google campaign against one or two pages | cost per WhatsApp conversation | 11 |
| 11 | **Content automation** — `@claude` drafts story twins from a brief issue, gated on the owner's tone + facts review | pages per week | 15 |
| 12 | **Platform modules as MCP** — agents work on platform data through RLS-scoped access (owner's addition) | owner hours per data task | 18 |
| 13 | **Harness smalls** — shared `build-app.sh`, CI double-run dedupe, decision graph (ADR count is 46) | CI minutes; context-load time | 16 |

**Out:** English stories (`/stories/en/`) — stays reserved in the URL structure, not built this quarter.

### Rules that bind the mandate

- Each item is its own initiative: `feature-spec` kickoff, plan file with an **Outcome metric**
  table and a check date of ship + 2–4 weeks, tiered execution, outcome check. One spec per session.
- `FACTS.md` remains the only fact source; no prices anywhere; inquiry by WhatsApp only.
- Story pages ship only as HE + AR pairs ([ADR 0007](0007-story-page-ships-only-with-arabic-twin.md)).
- GA4 stays at one hand-written event unless a deliberate decision adds another ([ADR 0006](0006-ga4-carries-whatsapp-click-tier-separation-console-side.md)); initiative #1 marks it a key event console-side.
- Observability stays deferred ([ADR 0045](0045-observability-home-re-deferred-to-2027-01-review.md)); if a marketing outcome cannot be measured without it, that is the queue-jumper.

## Consequences

- `docs/ROADMAP.md` gains a **Phase 2 — 2026-Q4 mandate: the marketing quarter** block above the
  original Phase 2 list, which is kept and marked as *deferred internal half*.
- The next quarterly review (2027-01-01) judges this mandate on its outcome checks, not on what was built.
- The monthly triage's shipped-but-unvalidated list starts filling from initiative #2 onward.
