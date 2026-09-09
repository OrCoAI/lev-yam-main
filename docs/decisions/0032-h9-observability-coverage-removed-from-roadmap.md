# 0032 — H9 (observability coverage) removed from the roadmap

- **Date:** 2026-08-26
- **Status:** superseded by ADR 0035 (2026-09-09: H9 reinstated via the master execution plan)
- **Decided by:** owner
- **Source:** `docs/plans/phase1-closeout.md` (kickoff note and §F); `docs/plans/observability-coverage.md` header note

## Context

H8 gave the platform edge-function traces (ADR 0013), but nothing watched any of it. Roadmap H9
"Observability coverage — everything watched, not just collected" was planned as four PRs
(SLOs, alerting, deploy events, RUM on `/app`, recurring money-spine and grant-drift checks). At
the Phase 1 close-out kickoff on 2026-08-12 the owner sequenced it "Stragglers first, then H9 in
full." Phase 0 was 2/3 done when work stopped.

## Decision

From the close-out plan:

> **H9 (observability coverage) was removed from the roadmap entirely — owner decision
> 2026-08-26.** At kickoff it was the final leg of this batch ("stragglers first, then H9 in
> full"); mid-batch the owner first descoped it from this session, then cut it from the roadmap
> altogether. Its plan file — observability-coverage.md — stays as reference only; nothing
> tracks it as pending work. What was removed with it, knowingly: `/app` RUM + JS error
> reporting, uptime/CTA alerting on the marketing funnel, reconciliation-as-monitor and
> grant-drift crons, deploy verification in Bluebox, and H8's two absorbed follow-ups (`deno
> check` in CI, `login/options` rate limit) — those two revert to open follow-ups in this
> plan's list below.

The plan file's own header:

> **REMOVED from the roadmap — owner decision 2026-08-26.** This file is kept as reference
> only; no roadmap item tracks this work. If observability coverage is ever revived, start
> from here (Phase 0 was 2/3 done) but re-verify everything against the then-current stack.

## Consequences

- From 2026-08-26 no roadmap item tracked alerting, SLOs, deploy events, or `/app` error
  reporting; detection stayed "someone tells the owner."
- `deno check` in `ci.yml` and the `login/options` rate limit returned to plain open follow-ups
  with no other home.
- The plan file was preserved rather than deleted so a revival could start from it.
- Superseded 2026-09-09: ADR 0035 reinstates H9 through the master execution plan.
