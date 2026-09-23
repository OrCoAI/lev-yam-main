# 0052 — Stories: four pairs a week for the first month, then the owner sets the pace

- **Date:** 2026-09-23
- **Status:** accepted — amends the target and cadence of [plans/stories-authoring-tool.md](../plans/stories-authoring-tool.md) (was: four pairs total); pulls mandate item 11 forward within [ADR 0046](0046-q4-2026-mandate-marketing-quarter.md)'s list; narrows [ADR 0047](0047-analytics-wiring-ga4-and-gsc-only-public-numbers.md) only by adding a manual, unpaid AI-citation check
- **Decided by:** owner (session after the first pair, PR #83)
- **Source:** owner, 2026-09-23 — "I want to have 4 per week on the first month, and after the first month to decide how many more we need. I want to be the number one SEO and AEO website."

## Context

The item-2 plan committed to four cornerstone pairs by 2026-10-04 and left "at cadence"
unnumbered. The first pair took one session and three localhost rounds. Search Console shows the
site found almost only for its own name (`לב ים`, `לב ים ג'סר א זרקא`) plus one restaurant
query — no page answers any non-brand query yet.

## Decision

1. **Cadence:** four story pairs (HE + AR) per week for four weeks —
   **16 pairs live by 2026-10-24**, the first pair (PR #83) included. On 2026-10-24 the owner
   decides the pace after that, from the numbers below.
2. **Topics:** Claude drafts a backlog of 16 query clusters (one page per cluster, as before);
   the owner approves or cuts it in one pass. It lives in the plan file.
3. **Arabic sign-off:** the owner reviews the Arabic twin on each PR (ADR 0007 unchanged — no
   pair merges without an approved Arabic twin).
4. **Throughput:** (a) the by-hand photo/video steps get scripted first, as their own Tier A PR;
   (b) mandate item 11 (`@claude` drafts a pair from a brief issue) is pulled forward, with its
   own kickoff; (c) review is batched — up to two pairs drafted per session and reviewed together
   on localhost. Two pairs of the *same* initiative in one session do not break the session
   hygiene rule (one approved spec per session); each pair still gets its own PR.
5. **"Number one", measured:** share of the target queries where a story page ranks **top 3**
   in Search Console, plus story impressions and clicks (free, automated); and an
   **AI-citation spot-check** — the owner asks ChatGPT, Perplexity and Google (AI Overview) the
   same fixed query list weekly and logs whether levyam.com is cited. Manual and free: no paid
   Ahrefs/Semrush plan (ADR 0047 stands); Claude has no access to those assistants.

## Consequences

- The owner's weekly load rises: ~4 page reviews + 4 Arabic reviews + a ~10-minute citation
  check. If it does not fit, the pace yields, not the gate or the Arabic review.
- Topics that need facts not yet in `FACTS.md` (Nimer's fishing calendar, trail details,
  weekend schedule) are ordered last, so their answers can arrive meanwhile.
- The item-2 outcome check moves to 2026-10-24/25 against the new target; the 2026-10-25 date
  stays.
