# 0026 — New RUM Experience frontends for both surfaces

- **Date:** 2026-08-13
- **Status:** accepted — execution was paused when H9 was removed from the roadmap on 2026-08-26 (ADR 0032) and resumed when the owner reinstated H9 on 2026-09-09 (ADR 0035)
- **Decided by:** owner (strategy session with Claude Code)
- **Source:** `docs/plans/master-execution-plan.md` Part 1 #12; `docs/plans/observability-best-practices-adoption.md` phase D

## Context

H9 Phase 2 adds RUM for `/app` beside the marketing site's RUM. Current-generation guidance
models each surface as a **New RUM Experience frontend** (frontend detection rules) rather
than a RUM Classic application definition, and frontend-backend linking (H9 Phase 3) requires
a minimum RUM JS version.

## Decision

- `/app` RUM is built as a second New-RUM frontend; staging is excluded via frontend
  detection/hostname rules — console-side, per the existing tier-separation doctrine.
- RUM JS pinned **>= 1.329** for both surfaces; the version is recorded in ARCHITECTURE §6b so
  the monthly skill can check drift.
- "Mask user actions" and "Mask personal data in URIs" on for both frontends.
- Phase-3 pre-work noted: cross-origin linking to Supabase functions needs the Cross-origin URL
  pattern plus CORS `Access-Control-Allow-Headers: traceparent, tracestate` on the edge
  functions — validated on staging before prod.

## Consequences

- Folded into H9 Phase 2's PR (master plan Step 7), Tier B; ARCHITECTURE §6b is rewritten
  truthfully in the same PR.
- The existing RUM tag and bizevents in the working environment stand (ADR 0029); this changes
  the model, not the home.
- H9 Phase 3's traceparent/CORS linking (Step 9) depends on the version pin landing here.
