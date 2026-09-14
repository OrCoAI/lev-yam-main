# Ideas — the parking lot

One dated line per idea, never elaborated here (`idea-capture` skill). Emptied in batch at
the monthly roadmap review; strategic ones are deferred upward to the quarterly review.
Module-specific ideas belong in `docs/modules/<module>.md` instead. Public repo: no prices,
no personal data.

Format: `- YYYY-MM-DD — one line [#tags]`

## 2026-09

- 2026-09-09 — AI pre-review at Gate 2 when the weekly report shows rising decision latency / Gate-2 queue depth (deferred, ADR 0034) [#harness]
- 2026-09-09 — Context/decision graph when ADR count > ~40 or product-context visibly dilutes (deferred, ADR 0034) [#harness]
- 2026-09-09 — Shared `scripts/build-app.sh` (install → lint → test → build) called by ci.yml, deploy.yml and build-site.sh so the three copies cannot drift (Step 3 review finding) [#ci]
- 2026-09-09 — Dedupe the push + pull_request double CI run per commit (concurrency keyed on head sha, or drop the push trigger for branches with an open PR) [#ci]
