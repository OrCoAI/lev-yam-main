# Ideas — the parking lot

One dated line per idea, never elaborated here (`idea-capture` skill). Emptied in batch at
the monthly roadmap review; strategic ones are deferred upward to the quarterly review.
Module-specific ideas belong in `docs/modules/<module>.md` instead. Public repo: no prices,
no personal data.

Format: `- YYYY-MM-DD — one line [#tags]`

## 2026-09

- 2026-09-09 — AI pre-review at Gate 2 when the weekly report shows rising decision latency / Gate-2 queue depth (deferred, ADR 0034) [#harness] *(re-parked 2026-09-22 — trigger not met, Gate-2 queue 0; ADR 0043)*
- 2026-09-09 — Context/decision graph when ADR count > ~40 or product-context visibly dilutes (deferred, ADR 0034) [#harness] *(→ Q4 mandate item 13, 2026-09-22)*
- 2026-09-09 — Shared `scripts/build-app.sh` (install → lint → test → build) called by ci.yml, deploy.yml and build-site.sh so the three copies cannot drift (Step 3 review finding) [#ci] *(→ Q4 mandate item 13, 2026-09-22)*
- 2026-09-09 — Dedupe the push + pull_request double CI run per commit (concurrency keyed on head sha, or drop the push trigger for branches with an open PR) [#ci] *(→ Q4 mandate item 13, 2026-09-22)*
- 2026-09-21 — Meter automation spend once API credits are funded, so the weekly report's cost-per-PR line has a source (today the workflows run on the subscription token, ADR 0042, and nothing is metered) [#harness] *(re-parked 2026-09-22 — nothing to meter yet)*
