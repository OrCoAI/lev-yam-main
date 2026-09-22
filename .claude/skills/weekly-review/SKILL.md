---
name: weekly-review
description: >
  Produce the weekly report — the solo product council: shipped vs the current roadmap block,
  Tier-C merges that auto-shipped, plan files without a close-out, outcome checks now due,
  the drift check (work off-roadmap), an analytics headline, an "Alerts & problems" line
  (Dynatrace problems + Bluebox Routine findings) and a "Harness health" line (time-to-merge
  by tier, rework rate, Gate-2 queue depth, cost per merged PR when exported). Runs headless
  from the weekly GitHub Action and on demand. Triggers: "weekly review", "weekly report",
  "what shipped this week", "drift check", "harness health".
metadata:
  version: '0.1.0'
---

# Weekly review

Answers "is the company on course?" — not "are the services healthy?" (that is the Bluebox
Routine, which this report *reads and links*, never re-implements — work order Part 4).

Output: one markdown report from [report-template.md](report-template.md), posted as the
GitHub issue `Weekly review YYYY-WW` by the workflow (or printed on demand). Every line
states its source; a source that is unavailable prints **n/a + why**, never a guess.

## Procedure

1. **Window**: the last 7 days ending today (`date -u +%F`). Week id `YYYY-WW` (ISO).
2. **Shipped vs planned**: `docs/ROADMAP.md` current block — items ticked this week (git log
   on the file) vs still open; PRs merged in the window from [queries.md](queries.md) §1,
   each with its declared tier (parsed from the PR body's `**Tier:**` line).
3. **Tier-C merges**: the subset that merged without a human checkpoint (ADR 0015) — listed
   explicitly; this is the weekly-eyes guarantee for autonomous merges.
4. **Open plans without close-out**: `docs/plans/*.md` linked from the roadmap's current
   block whose `## Close-out` section is missing or empty.
5. **Outcome checks due**: plan files with an `## Outcome metric` table whose *Check date* ≤
   today and no filled `## Outcome check` (work order G5). List them; the owner writes the
   verdict into the plan. **Shipped-but-unvalidated must never pile deeper than one cycle** —
   flag if any is more than a month overdue.
6. **Drift check**: PRs and branches in the window that do not reference a roadmap block /
   step / module-log item (queries §2). Report `N of M off-roadmap` and name them. Target: 0.
7. **Analytics headline**: from `.reports/analytics.json` (queries §7) — sessions,
   `whatsapp_click` total and top 3 pages, GSC clicks/impressions and top 3 queries, each with
   the delta against the trailing 28-day weekly average; a source with an `error` field prints
   `n/a — <reason>`, never a guess and never another source.
8. **Alerts & problems**: open/closed Davis problems in the window (queries §3) and the
   Bluebox Routine's findings (`bluebox ask`, queries §4). Alerts stay inside the platforms by
   decision (ADR 0018) — this line is the weekly eyes. If it proves too slow, that is the
   logged trigger for an external channel; say so if an alert sat unseen > 7 days.
9. **Harness health** (ADR 0034): time-to-merge per tier (median), rework rate (PRs with a
   second push after opening, or a `changes_requested` review), Gate-2 queue depth (open PRs
   awaiting the owner), cost/tokens per merged PR from the Claude Code OpenTelemetry export
   (`n/a until H9.5-E`). These numbers decide tier promotions and the deferred AI pre-review.
10. **Quarterly checklist reminder** (work order G6.4), first week of each quarter only:
    `@simplewebauthn/server` on Deno is not watched by dependabot — check its releases.
11. **Open decisions**: questions waiting on Gate 1 (open plans with blocking questions;
    open PRs marked hold).

## Rules
- Read-only against every external system. Never opens PRs, never edits plans.
- Numbers come from commands in `queries.md`; never from memory of last week.
- One report, one issue; the monthly and quarterly skills consume these reports as evidence.
