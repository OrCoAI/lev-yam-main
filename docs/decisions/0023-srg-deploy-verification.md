# 0023 — Site Reliability Guardian supersedes hand-rolled deploy verification

- **Date:** 2026-08-13
- **Status:** accepted — execution was paused when H9 was removed from the roadmap on 2026-08-26 (ADR 0032) and resumed when the owner reinstated H9 on 2026-09-09 (ADR 0035)
- **Decided by:** owner (strategy session with Claude Code)
- **Source:** `docs/plans/master-execution-plan.md` Part 1 #9; `docs/plans/observability-best-practices-adoption.md` phase A

## Context

H9 Phase 4 planned a timestamp-anchored `bluebox ask` comparison in `deploy.yml` as the deploy
verification mechanism. The official-docs research found that "native platform capabilities
supersede hand-rolled mechanisms": SDLC events are the platform-native deployment marker and
gate. H9's "no deployment-marker API" note is true only for Bluebox's environment.

## Decision

- Create a **lifecycle guardian** (SDLC_EVENT type) with DQL objectives over the post-deploy
  window: failed-request count == 0 per edge service; success count >= 1; optionally the Phase-1
  count/freshness SLOs as objectives.
- Wire `deploy.yml`: a post-deploy step POSTs an SDLC event to
  `/platform/ingest/v1/events.sdlc` (token scope `openpipeline.events_sdlc`, repo secret)
  carrying the commit SHA and `timeframe.from/to`; a Workflow with event trigger
  (`event.kind == "SDLC_EVENT"`) runs the guardian; the verdict surfaces in the workflow log.
- Division of labor: **SRG = deterministic verdict; `bluebox ask` = investigator when the
  verdict fails.** H9 Phase 4's Bluebox comparison moves from "the mechanism" to "the
  on-failure follow-up".
- Correct H9's "no deployment-marker API" note in `observability-coverage.md` (Bluebox-only).
- Config-as-code: guardian + workflow as settings YAML via dtctl. Terraform deferred — a
  one-person org with git-versioned YAML is the accepted state model; revisit at the quarterly.

## Consequences

- Tier A; lands in H9 Phase 4's slot (master plan Step 10). Gated by capability confirmation
  (ADR 0031): if SRG / Workflows / SDLC ingest are not enabled, H9 Phase 4's mechanism stays and
  this phase becomes a logged follow-up.
- Invariant 7 (additive) holds: a broken SRG degrades to "no verdict", never a failed deploy
  step. The workflow step is **non-blocking until trust is earned**; flipping it to blocking is
  a later, explicit decision.
- Owner touchpoint: the SDLC-ingest token repo secret. Phase 1 closure requires one SRG verdict
  recorded from a real deploy.
