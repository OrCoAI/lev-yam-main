# 0035 — H9 reinstated through the master execution plan; an "Operating system" roadmap block gates Phase 2

- **Date:** 2026-09-09
- **Status:** accepted — supersedes ADR 0032 (H9 removed from the roadmap, 2026-08-26)
- **Decided by:** owner (kickoff of the master execution plan, closed questions answered 2026-09-09)
- **Source:** `docs/plans/master-execution-plan.md` kickoff; conflicts raised per the CLAUDE.md conflict rule

## Context

The master execution plan (v1.1, revised 2026-09-09) builds Steps 4, 7, 9, 10 and 11, all of
H9.5 (`observability-best-practices-adoption.md`), session decisions 9–17 and workstream M0.2
on H9 (`observability-coverage.md`) Phases 1–5 running. But the roadmap, `phase1-closeout.md`
and the header of `observability-coverage.md` all recorded H9 as **removed from the roadmap by
owner decision on 2026-08-26** (ADR 0032), and Phase 1 + 1.5 were closed the same day with an
alignment verdict — while the plan's framing was "Phase 1 closes when the 12 steps merge". The
roadmap had no entry for the operating-system work at all. Two documents contradicted each
other; per the conflict rule this was raised, not coded around.

## Decision

1. **H9 is reinstated, via this plan.** The 2026-08-26 removal is superseded. Steps 4, 7, 9,
   10, 11 and the H9.5 phases run as written in the master plan; `observability-coverage.md`
   is active again (its header is corrected, its Phase 0 findings still stand but are
   re-verified against the current stack per its own note).
2. **Roadmap slot:** a new block, **"Operating system (gate into Phase 2)"**, sits between
   Phase 1.5 and Phase 2 and tracks the master plan's 12 steps. The existing Phase 1 + 1.5
   close-out (2026-08-26) stays untouched — it is history. The plan's "Phase 1 is closed when…"
   criteria are read as the closure criteria of *this block*.
3. **The first quarterly review remains the gate into Phase 2** (work order G7, master plan
   Part 4) — unchanged.
4. Branch protection on `main` is applied by Claude Code through the GitHub API (the token
   has `repo` scope); the owner confirms it in the repository settings afterwards.
5. `dtctl auth login` is owner-interactive, never agent-run (M0.1) — this is also the reason
   the future permissions allowlist (ADR 0022) denies `dtctl auth *` to agents.

## Consequences

- Session decisions 9–17 (ADRs 0023–0031) are executable again; their status lines record
  the pause and the resumption so the history stays readable.
- `phase1-closeout.md` keeps its removal note with a one-line pointer here; the record is
  not rewritten.
- The Phase 1 close-out's list of what was "knowingly removed" with H9 (`/app` RUM + JS error
  reporting, uptime/CTA alerting, reconciliation-as-monitor, deploy verification, `deno check`
  in CI, the `login/options` rate limit) becomes the checklist H9's phases must actually
  deliver.
