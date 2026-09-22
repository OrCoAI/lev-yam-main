# 0047 — Initiative #1 measures with GA4 + Search Console only; Ahrefs/Semrush are a paid decision; traffic numbers may appear in the public weekly issue

- **Date:** 2026-09-22
- **Status:** accepted — amends the item-1 row of [0046](0046-q4-2026-mandate-marketing-quarter.md)
- **Decided by:** owner + Claude Code (kickoff of `docs/plans/marketing-analytics-wiring.md`)
- **Source:** the `feature-spec` alignment questions, in session

## Context

The mandate row for initiative #1 reads "GA4 `whatsapp_click` as a key event, Search Console,
Ahrefs/Semrush (connected as MCP) feeding the `weekly-review` analytics headline". At kickoff the two
SEO MCPs were probed: Ahrefs returns `Insufficient plan` on every endpoint, including the free
domain-rating call and the subscription-info call (the free tier carries no API access — known
since 2026-08-11); Semrush has an active subscription but zero API units. Neither is a wiring problem; both are money.

Two further questions had no standing rule: how a headless CI report gets analytics data when its
agent is denied `curl`, `node` and MCP by design (ADR 0042's worker), and whether traffic counts may
be printed in a GitHub issue on a public repository.

## Decision

1. **Sources for initiative #1 are GA4 and Google Search Console only** — the two verified, free
   sources. Ahrefs (API plan) and Semrush (API units) are **parked as a spend decision for the
   monthly triage**; items 4 (Brand Radar) and 9 (referring domains) will re-raise it with their
   own metric need. The mandate is not otherwise changed.
2. **The workflow pulls, the agent reads.** A plain step in the shared report worker
   (`agent-report.yml`), run before the agent and gated on a boolean input plus the secret, calls
   the GA4 Data API and the GSC Search Analytics API with a **Google service-account key stored as
   the repo secret `GOOGLE_SA_KEY`**, and writes one JSON snapshot the agent only `Read`s. The
   agent step never names the secret, so GitHub never puts it in the agent's environment. Keyless
   Workload Identity Federation was offered and declined for setup cost. The key is rotated at the
   2027-01-01 review.
3. **Traffic numbers may appear in the public weekly issue.** Sessions, clicks, impressions,
   `whatsapp_click` counts and top query strings are not PII, prices or customer data
   (ARCHITECTURE invariant 3). The snapshot itself is a workflow artifact, never committed.
4. **Outcome metric:** three consecutive Sunday reports whose Analytics headline carries real GA4 +
   GSC numbers with no owner export; check date 2026-10-19.

## Consequences

- `docs/ROADMAP.md` item 1 of the Q4 mandate reads "GA4 + Search Console" and links the plan; the
  Ahrefs/Semrush line becomes an explicit parked decision on the same item.
- The 2027-01-01 review's re-check list gains "rotate `GOOGLE_SA_KEY`" next to the OAuth-token
  regeneration.
- The monthly-triage prompt's "no analytics credentials are configured" sentence is retired by
  the implementing PR.
- Every later mandate item can name a GA4 / GSC number as its outcome metric and expect the weekly
  review to report it.
