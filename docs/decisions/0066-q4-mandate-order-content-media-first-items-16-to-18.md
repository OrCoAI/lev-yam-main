# 0066 — The Q4 mandate gains items 16–18 and is put in the owner's order: content & media first, the paid test last

- **Date:** 2026-10-07
- **Status:** accepted — amends the list and order of [0046](0046-q4-2026-mandate-marketing-quarter.md) (after [0065](0065-roadmap-consolidated-q4-mandate-merged-to-five-lines.md)'s merges); leaves [0052](0052-stories-four-pairs-a-week-for-the-first-month.md)'s 16-pairs-by-2026-10-24 target unchanged
- **Decided by:** owner (roadmap session, 2026-10-07) + Claude Code
- **Source:** the session's deep dive on the mandate; the owner's three additions and the order given as IDs

## Context

After ADR 0065 the open mandate was five lines (2, 3, 7, 9, 10) plus sub-lines, in the order the
first quarterly review proposed. Walking through each item, the owner added three:

> A complete section to optimize our content and media — verify that all the information is up to
> date, all the photos are constantly added, videos are updated; create a weekly routine that
> verifies everything across all marketing channels.
>
> Review marketing reporting scheduling.
>
> Add Claude connected to all my social platforms by MCP or authorized connectors.

Marketing reporting today is one "Analytics headline" section of nine in the engineering-oriented
weekly issue; nothing reports social, GBP or content freshness.

## Decision

**Three new items:**

- **18. Content & media optimization**: one source of truth per kind of content (facts `FACTS.md`;
  photos a Google Drive folder → `media/`; video `video/`; live activity `/app/events`), a one-time
  inventory, freshness rules whose thresholds the owner sets, a photo/video pipeline (consent for
  faces, never names), and a weekly routine: an automated cross-channel check plus the owner's
  ~20–30 min list with drafts ready, and a monthly deeper audit.
- **17. Weekly marketing report**: its own weekly issue **and** an email to the owner (owner's
  picks: separate report, both channels). It carries **social publishing** (was item 6): a reel a
  week and a post per story, tracked against the cadence (owner, "in 17, part of the report").
- **16. Connect social + GBP to Claude**: **read + draft, the owner publishes** (owner's pick). UTM
  on every owned link is part of it.

**The order** (owner, as IDs): **18, 17, 3, 2, 7, 9, 16, 10.**

**Three collisions raised and resolved by the owner:**

1. 18, 17 and 7 need 16, which sits 7th → **keep the order, phase it**: 18 and 17 start with the
   site and Drive; GBP and social join when 16 lands; 7 runs by hand until then.
2. Stories sit 4th but ADR 0052 fixes 16 pairs by 2026-10-24 → **the pair cadence runs in parallel**
   until that date; position 4 is its next phase (CTA sharpening, the pace after 24 Oct).
3. Social publishing had no position → **inside 17**.

**Boundaries carried forward unchanged:** the automated report agents never hold a social, GBP or
email credential. Numbers reach them as a file from a fixed pre-agent step
([0047](0047-analytics-wiring-ga4-and-gsc-only-public-numbers.md),
[0048](0048-report-agents-hold-no-write-and-actions-are-sha-pinned.md)), and the connectors live
in the owner's own sessions. Item 17's email needs its own scoped send credential (Tier A, security
review).

**Parked**, not adopted (Claude's suggestions in the same session; the owner chose to decide only the
order): lead → booking attribution on quotes, a December-season push, past clients + partners,
named offers. They are in `docs/ideas.md` for the 2026-11-01 monthly batch.

## Consequences

- The roadmap's mandate list is written in the decided order, with numbers kept as IDs.
- The engineering weekly's Analytics headline moves to item 17's report when 17 ships.
- Item 15's 2026-11-10 check (4 reels posted) is tracked in item 17's report.
