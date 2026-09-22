# 0044 — ADR 0040 confirmed; the Operating-system block closes on a reduced Part 4, and Phase 2 opens

- **Date:** 2026-09-22
- **Status:** accepted — confirms [0040](0040-g5-ships-ahead-of-h9-phase-5.md); amends the master plan's Part 4 closure criteria
- **Decided by:** owner (first quarterly review, agenda item 3, [issue #62](https://github.com/OrCoAI/lev-yam-main/issues/62))
- **Source:** issue #62 §7.1 and §7.2; `docs/plans/master-execution-plan.md` Part 4

## Context

Two open conflicts rode into the review from the pack:

1. **ADR 0040** shipped G5's outcome-metric field ahead of H9 Phase 5 (amending ADR 0019's
   sequencing) and was merged in PR #58 with its Status line "flagged for owner confirmation".
2. **Master plan Part 4** closes the Operating-system block only when, among other things, "the
   working environment shows green synthetic monitors, armed detectors, SLOs evaluating, both
   dashboards rendering, and one SRG verdict" (criterion 4) and every H9/H9.5 acceptance is met
   (criterion 1). By [ADR 0041](0041-observability-home-deferred-to-first-quarterly-review.md)
   that environment does not exist, and by [ADR 0045](0045-observability-home-re-deferred-to-2027-01-review.md)
   it will not this quarter. The plan foresaw this: "the review must either accept a reduced
   closure or re-scope Part 4, and say so in an ADR."

## Decision

1. **ADR 0040 is confirmed.** Its flag is cleared; G5's acceptance ("the next initiative ships with
   a named outcome metric") opens with the first Phase 2 initiative, as written there.
2. **Reduced closure.** The Operating-system block closes today on its **process criteria**:
   - criterion 1's process half — Steps 1, 2, 3, 5, 6, 12 (cadence) merged with their acceptance met;
   - criterion 2 — a Tier-C change flowed to production with zero owner interactions (docs #53/#63/#68,
     dependabot #56). **Not yet shown for a code change**; and its second clause — "a `supabase/` diff
     demonstrably still requires all checkpoints" — **not yet shown either**, because no `supabase/`
     diff has been opened since tiers landed on 2026-09-09. Both carried as standing observations
     for the weekly review, not blockers;
   - criterion 3 — met 2026-09-22 (three cron issues #65/#66/#70; `@claude` PR #68 from issue #67);
   - criterion 5 — Phase 1 / 1.5 ticked (2026-08-26, PR #47).

   **Criterion 4 and the observability half of criterion 1** (Steps 4, 7, 8, the parked parts of 9
   and 11, Step 10 except its docs carve-out; H9 Phases 1–5; H9.5 A–F) **move under the deferred
   observability decision** (ADR 0045) and are not counted against the block.
3. **Phase 2 opens** with the mandate in [ADR 0046](0046-q4-2026-mandate-marketing-quarter.md),
   written into `docs/ROADMAP.md`.

## Consequences

- The roadmap's Operating-system block is closed with the reduced-closure note on its Closure line;
  the parked steps keep their PARKED markers and point at ADR 0045.
- `docs/plans/master-execution-plan.md` gets its `## Close-out` (what shipped, what moved, alignment)
  and the companion plans (`lev-yam-gap-analysis-work-order.md`, `observability-best-practices-adoption.md`,
  `observability-coverage.md`) are closed by reference — their open halves are the parked observability work.
- Step 9's unblocked half (`deno check` in `ci.yml`; rate limit on `login/options`) and the Step 10/11
  docs carve-outs are **ordinary roadmap items** now, no longer part of a block.
- "Tier-C code change flows untouched" and "a `supabase/` diff still hits every checkpoint" stay on
  the weekly review's watch list until each is observed once.
