# Weekly review YYYY-WW (YYYY-MM-DD → YYYY-MM-DD)

**On course?** one sentence.

## Shipped vs planned — block: <roadmap block>
| PR | Tier | Merged | Roadmap item |
|---|---|---|---|

Ticked this week: … · Still open in the block: …

## Tier-C merges (no human checkpoint)
- #… — title — what path class made it C

## Open plans without close-out
- `docs/plans/….md` — since …

## Outcome checks due
| Plan | Metric | Check date | Overdue by |
|---|---|---|---|

## Drift check
N of M PRs off-roadmap: … (target 0)

## Analytics headline
<!-- Δ = current − (trailing ÷ 4), written `+N (+P%)`; `0` when equal, `n/a` when either
     side is null. `position` is an average — current value only, never a Δ. Quote up to
     three rows per list, or as many as the file holds. n/a lines carry the snapshot's
     reason; a partly-failed source reports only the part that failed. -->
- GA4 (YYYY-MM-DD → YYYY-MM-DD): sessions … (Δ …) · users … · `whatsapp_click` … (Δ …) — top pages: `…` n, `…` n, `…` n · top sources: `…` n, `…` n · channels: … / …
- Search Console (YYYY-MM-DD → YYYY-MM-DD): clicks … (Δ …) · impressions … (Δ …) · CTR …% · avg position … — top queries: `…` n, `…` n, `…` n · top pages: `…` n
- Dynatrace bizevents: n/a — observability home deferred (ADR 0045)

## Alerts & problems
- Davis problems (home env): opened … / closed … / open now … — links
- Bluebox Routine (edge functions): … — link to the Routine run
- Unseen > 7 days? yes/no

## Harness health
| Tier | PRs merged | Median time-to-merge | Rework rate |
|---|---|---|---|
Gate-2 queue: N open PRs awaiting the owner (oldest: …) · Cost per merged PR: n/a until H9.5-E

## Open decisions (Gate 1)
- …

*Sources: gh CLI, git log, docs/ROADMAP.md, docs/plans/, `.reports/analytics.json` (GA4 + Search Console), dtctl (context …), bluebox ask.*
