# 0040 — G5's outcome-metric field ships ahead of H9 Phase 5, carrying Phase 5's telemetry bullet with it

- **Date:** 2026-09-21
- **Status:** accepted — amends 0019's ownership split; **flagged for owner confirmation** (see Context)
- **Decided by:** Claude Code (Step 11 partial), raised to the owner in the PR rather than settled silently
- **Source:** [ADR 0019](0019-outcome-metrics-validation-loop.md) Consequences; [ADR 0038](0038-new-dedicated-dynatrace-environment.md)

## Context

ADR 0019 set an explicit sequencing rule for the `docs/MODULE-TEMPLATE.md` edit:

> Ownership split with H9: Phase 5 owns the "telemetry is part of done" template edit; G5's
> field lands **in or after** that PR (master plan Step 11, a single edit), never as a parallel
> edit to the same lines.

That rule was written when Phase 5 was expected to land on schedule. It has not: H9 Phase 5's
remaining substance is the Dynatrace MCP server in `.mcp.json`, which needs the **new Dynatrace
environment that does not exist yet** (ADR 0038, blocker B1). Following 0019 literally would hold
G5 — the entire validation loop, and the only mechanism in the operating system that asks whether
shipped work *worked* — behind a step with no date on it.

The hazard 0019 names is specific and mechanical: **two PRs editing the same template lines in
parallel.** That hazard cannot occur here. There is no parallel Phase 5 PR to conflict with, and
this PR writes **both** bullets — G5's outcome-metric field and Phase 5's "instrumentation is part
of the slice" bullet — as one edit to `MODULE-TEMPLATE.md` §0. That is precisely the "single edit"
0019 asked for; only its authoring step has changed.

## Decision

G5's template half ships now, in Step 11's partial PR, and carries Phase 5's telemetry bullet with
it. When B1 clears and Phase 5 runs, it finds that bullet already in place and adds only what is
genuinely its own: the Dynatrace MCP entry in `.mcp.json`, the mandatory production-context step,
and the CLAUDE.md standing rule.

**This ADR is flagged for the owner.** It reverses a sequencing constraint the owner accepted in
ADR 0019. If the answer is "no, wait for Phase 5", reverting is a single-file revert of the
`MODULE-TEMPLATE.md` §0 hunk; nothing else in Step 11's partial depends on it.

## Consequences

- G5's **template** half is done. Its **acceptance** ("at least the next initiative ships with a
  named outcome metric") is still open and cannot close until a Phase 2 initiative kicks off —
  recorded as such in the roadmap rather than ticked.
- Phase 5's scope shrinks to three items; the master-plan Step 11 row says which.
- No existing plan file is retrofitted. All 14 plans with a `## Close-out` predate this rule and
  have no `## Outcome metric`; the weekly and monthly mechanisms both scope to plans that *have*
  one, so the backlog is not dragged in as false positives.
- If the owner reverses this, ADR 0019 stands unamended and this ADR is marked superseded.
