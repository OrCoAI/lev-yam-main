# Observability best-practices adoption (H9.5) — implement before the first quarterly review

*Kickoff 2026-08-13 · companion to `observability-coverage.md` (H9) · source: Dynatrace/Bluebox
official-docs research synthesis (2026-08-13)*

## Why

The H9 plan is validated by official guidance in its core choices (count/freshness SLOs at
low volume, native synthetic HTTP monitors, detectors-as-YAML, per-surface RUM, console-side
tier separation). The research surfaced a set of amendments where **native platform
capabilities supersede hand-rolled mechanisms** or where current-generation guidance adds
hardening. This plan lands all of them **before the first quarterly review**, so the review
audits a current-generation ecosystem, not a snapshot with known gaps.

**Standing context (revised 2026-08-13):** the observability home is the owner's working
environment (`pzh8968h.sprint`) with **full access and unconstrained budget** — no tenant
migration. Cost-discipline items below are therefore **hygiene defaults, not constraints**:
follow them where free, relax them where they'd cost simplicity. Dynatrace + Bluebox are
connected and must stay relevant at every platform step — the monthly `obs-best-practices`
skill (shipped alongside this plan) is the standing mechanism that keeps this true after
H9.5 lands.

## Phases (each its own PR through the gate; tiers per the work order)

### A — SRG deploy verification (supersedes H9 Phase 4's hand-rolled mechanism) — Tier A
- [ ] **Confirm capabilities first** (M0.2 in the master plan): SRG, Workflows, and
      OpenPipeline SDLC ingest enabled in the working environment (expected yes — full
      access; if any is gated, H9 Phase 4's timestamp-anchored `bluebox ask` remains the
      mechanism and this phase converts to a logged follow-up).
- [ ] Create a **lifecycle guardian** (SDLC_EVENT type) with DQL objectives over the
      post-deploy window: failed-request count == 0 per edge service; success count ≥ 1;
      optionally reference the Phase-1 count/freshness SLOs as objectives.
- [ ] Wire `deploy.yml`: post-deploy step POSTs an SDLC event to
      `/platform/ingest/v1/events.sdlc` (token scope `openpipeline.events_sdlc`, repo
      secret) carrying commit SHA + `timeframe.from/to`; a Workflow with event trigger
      (`event.kind == "SDLC_EVENT"`) runs the guardian; verdict surfaced in the workflow log.
- [ ] **Correct H9's "no deployment-marker API" note** in `observability-coverage.md`:
      true for Bluebox's env only — SDLC events are the platform-native marker/gate.
- [ ] Division of labor stated in the plan: **SRG = deterministic verdict; `bluebox ask` =
      investigator when the verdict fails.** The post-deploy Bluebox comparison from H9
      Phase 4 moves from "the mechanism" to "the on-failure follow-up".
- Config-as-code: guardian + workflow as settings YAML via dtctl (Terraform deferred —
  one-person org, git-versioned YAML is the accepted state model; revisit at quarterly).

### B — Davis detector + SLO hardening (lands with/into H9 Phase 1's PR) — Tier B
- [ ] Every detector: `interval: 1m`, stable dimensions only, `fieldsKeep` to strip
      volatile fields, no `sort`/`limit`/timeframe override (Jan-2026 DQL guide).
- [ ] Zero-traffic conditions (site-quiet, CTA-dead, zero-traffic-48h) use the detector's
      **"Alert on missing data"** feature — not wide count-over-24h windows scanned every
      minute (cleaner semantics; also cheaper, though budget is not a constraint here).
- [ ] Detectors run as a **service user** with least-privilege Grail read scopes.
- [ ] SLOs authored as **Grail/DQL-generation SLOs** (not classic) so phase A can
      reference them as guardian objectives. Static thresholds (auto-adaptive needs ~14d
      of dense data we don't have).
- [ ] Document the **switchover thresholds** in the plan: at ~hundreds of requests/day →
      rate-based SLOs + burn-rate alerting (-1h look-back, static threshold ~10–14); dense
      14d data → auto-adaptive candidates. The monthly skill checks these every cycle.

### C — OpenPipeline ingest-time masking (second PII layer) — Tier A
- [ ] DQL masking processors in both environments (marketing RUM/bizevents env; Bluebox's
      OTel env) as a backstop behind the code-side allow-list — invariant 3 gains an
      enforcement layer that survives a code bug.
- [ ] Validate masking patterns in a Notebook first (official guidance — mis-patterns
      cause silent data loss).
- [ ] ARCHITECTURE.md invariant 3 updated: allow-list in code + masking at ingest,
      two layers, both mandatory for new signal types.

### D — RUM current-generation (lands with/into H9 Phase 2's PR) — Tier B
- [ ] `/app` RUM built on the **New RUM Experience frontend** model (frontend detection
      rules), not RUM Classic app definitions; staging excluded via frontend
      detection/hostname rules (console-side, per existing doctrine).
- [ ] RUM JS pinned ≥ 1.329 (frontend-backend linking prerequisite for H9 Phase 3);
      version recorded in ARCHITECTURE §6b so the monthly skill can check drift.
- [ ] "Mask user actions" + "Mask personal data in URIs" on for both frontends.
- [ ] Phase-3 pre-work noted: cross-origin linking to Supabase functions needs the
      Cross-origin URL pattern + CORS `Access-Control-Allow-Headers:
      traceparent, tracestate` on the edge functions — validate on staging before prod.

### E — Dev-loop + access hardening — Tier B (workflow/docs surface)
- [ ] MCP: **platform token** (not OAuth-client), least-privilege read scopes
      (`storage:*:read` as needed), `${VAR}` interpolation so config commits clean,
      `DT_GRAIL_QUERY_BUDGET_GB` set to a sane guardrail (e.g., 100 GB) — a runaway-query fuse, not a budget constraint.
- [ ] Note the OSS local MCP server's maintenance-mode status; prefer the Dynatrace-hosted
      remote MCP or dtctl-with-Agent-Skill; record the choice as an ADR.
- [ ] dtctl production context pinned to a **readonly** safety level for dev-loop use;
      write-capable context reserved for explicit `dtctl apply` sessions.
- [ ] Create ownership team `levyam-solo` (`builtin:ownership.config`) with contact
      routing; apply via tags to the edge services + frontends. One person today;
      correct routing plumbing forever.
- [ ] **Harness telemetry into Grail**: enable Claude Code's OpenTelemetry export
      (usage/cost/session metrics) to the working environment, so agent efficiency
      lives beside product telemetry. Feeds the weekly report's "Harness health" line
      (cost per merged PR, time-to-merge by tier, rework rate). Same secret hygiene as
      every other exporter; no prompt/code content is exported — metrics only.

### F — Query-hygiene codification — docs-only carve-out
- [ ] CLAUDE.md/plan standing rules: `timeseries` over ingested metrics is free —
      `fetch … | makeTimeseries` is for dashboards/on-demand only, never 1-minute
      detectors; frequently-run aggregations become OpenPipeline-extracted metrics;
      bizevents cannot be backdated >24h (constrains any future buffering/replay design).

## Sequencing vs. H9 and the work order

B and D are **amendments folded into H9 Phases 1 and 2 respectively** (same PRs, not
separate ones). A supersedes H9 Phase 4's mechanism and lands in its slot. C and E are
independent and can land any time after the work order's tier system exists. F is minutes.
**Deadline: all phases merged before the first quarterly review** (work-order step 7) — the
review's architecture audit then runs against a current-generation ecosystem, and the
monthly `obs-best-practices` skill keeps it current from that point on.

## Invariants check
Inv 2 (secret hygiene): holds — SDLC token is a repo secret; MCP tokens env-var-interpolated.
Inv 3 (allow-list): **strengthened** by C. Inv 7 (additive): holds — SRG verdict failure
gates promotion but a broken SRG degrades to "no verdict", never a failed deploy step
(workflow step is non-blocking until trust is earned; flip to blocking is a later,
explicit decision). Owner decisions (no external channels, pos.html dark): untouched.

## Open questions
1. ~~Which tenant?~~ **Resolved 2026-08-13**: the working environment stays; no
   migration; unconstrained budget.
2. **H9 open question 4 escalates**: write access to Bluebox's Dynatrace env
   (`tgo73062`) for SLO/alert objects now also blocks phases A/B objective wiring.
   Confirm access path first. *M0.1 (2026-09-09): dtctl context `levyam-bluebox` →
   `https://tgo73062.apps.dynatrace.com` created (host confirmed answering; token-ref
   `levyam-bluebox-oauth`); the owner's interactive login is still outstanding, so the
   write path is unconfirmed — re-checked before Step 4.*
3. **Capability availability** for SRG / Workflows / OpenPipeline SDLC — phase A
   step 1 / M0.2 verifies; if gated, the documented fallback applies.

## M0 record (2026-09-09, verdicts 2026-09-14)

| Check | Verdict |
|---|---|
| `my-env` default context pinned to **readonly** | done — `pzh8968h.sprint.apps.dynatracelabs.com`, token-ref `my-env-oauth` |
| Named write context for `dtctl apply` sessions | done — `my-env-write` (readwrite-all, same token-ref) |
| `levyam-bluebox` context (tgo73062) | done — `https://tgo73062.apps.dynatrace.com`, owner logged in 2026-09-09 |
| `my-env` session authenticated | yes (2026-09-09) — **but the environment is DEACTIVATED**: every endpoint returns `404 EnvironmentDisabled`. The marketing RUM tag returns 404 on levyam.com. → [ADR 0038](../decisions/0038-new-dedicated-dynatrace-environment.md): a new dedicated environment becomes the home |
| SRG app · Workflows · OpenPipeline SDLC ingest · synthetic HTTP + outage handling · Davis detector schema | **re-verify in the new environment** (its own Phase 0) — nothing in the deactivated tenant can be read |
| `tgo73062` write path for SLO/alert objects | **no** — and no read path either: SLOs `missingScopes: ["slo:slos:read"]`, dashboards/workflows/buckets 403, Grail "Insufficient permission to access the tenant". Only `bluebox ask` works. Blocked on Bluebox granting scopes; H9 Phase 1's SLOs are authored in the new home or deferred |
| Bluebox dashboard-listing 403 | **confirmed, same cause** (no document permissions for the owner's identity) — ticketed with the scope request above |
| Edge-function spans reaching Bluebox | **unconfirmed** — `bluebox ask` sees 0 spans in 3 days, no SLOs, no deploy events; low admin traffic is plausible. Follow-up: test invite on staging, then re-ask |

**Consequence for this plan:** phases A–F run against the new environment once it exists; the
H9 Phase 0 baselines (~8 CTAs, ~27 sessions/day) are superseded by a fresh collection week.
