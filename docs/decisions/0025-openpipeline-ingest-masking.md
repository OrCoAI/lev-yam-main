# 0025 — OpenPipeline ingest-time masking as PII layer 2

- **Date:** 2026-08-13
- **Status:** accepted — execution was paused when H9 was removed from the roadmap on 2026-08-26 (ADR 0032) and resumed when the owner reinstated H9 on 2026-09-09 (ADR 0035)
- **Decided by:** owner (strategy session with Claude Code)
- **Source:** `docs/plans/master-execution-plan.md` Part 1 #11; `docs/plans/observability-best-practices-adoption.md` phase C

## Context

ARCHITECTURE invariant 3 makes span/event attributes a code-side allow-list. A single layer
survives only as long as the code is bug-free; the research recommended an ingest-time
backstop "that survives a code bug".

## Decision

- DQL masking processors in **both environments** — the marketing RUM/bizevents environment
  (`pzh8968h.sprint`) and Bluebox's OTel environment (`tgo73062`) — as a backstop behind the
  code-side allow-list.
- Masking patterns are **validated in a Notebook first**, per official guidance: mis-patterns
  cause silent data loss.
- `docs/ARCHITECTURE.md` invariant 3 is updated to read: allow-list in code + masking at
  ingest, two layers, both mandatory for new signal types.

## Consequences

- Tier A; independent of H9's phases, can land any time after the tier system exists (master
  plan Step 8).
- Invariant 3 is strengthened, not replaced: the code-side allow-list stays the first layer.
- Requires write access to `tgo73062` (ADR 0030) for the second environment's processors.
