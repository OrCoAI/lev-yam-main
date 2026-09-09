# 0024 — Davis detector and SLO hardening to Jan-2026 guidance

- **Date:** 2026-08-13
- **Status:** accepted — execution was paused when H9 was removed from the roadmap on 2026-08-26 (ADR 0032) and resumed when the owner reinstated H9 on 2026-09-09 (ADR 0035)
- **Decided by:** owner (strategy session with Claude Code)
- **Source:** `docs/plans/master-execution-plan.md` Part 1 #10; `docs/plans/observability-best-practices-adoption.md` phase B

## Context

H9's core choices (count/freshness SLOs at low volume, native synthetic HTTP monitors,
detectors-as-YAML) were validated by official guidance, but the Jan-2026 DQL guide for
detectors adds hardening H9 Phase 1 did not yet include. Baselines from H9 Phase 0 (~8 CTAs,
~27 sessions/day) remain valid for tuning.

## Decision

- Every detector: `interval: 1m`, stable dimensions only, `fieldsKeep` to strip volatile
  fields, no `sort` / `limit` / timeframe override.
- Zero-traffic conditions (site-quiet, CTA-dead, zero-traffic-48h) use the detector's
  **"Alert on missing data"** feature, not wide count-over-24h windows scanned every minute.
- Detectors run as a **service user** with least-privilege Grail read scopes.
- SLOs authored as **Grail/DQL-generation SLOs** (not classic) so the guardian (ADR 0023) can
  reference them as objectives. **Static thresholds** — auto-adaptive needs ~14 days of dense
  data we do not have.
- Count/freshness SLOs stay until the documented **switchover thresholds**: at ~hundreds of
  requests/day, move to rate-based SLOs + burn-rate alerting (-1h look-back, static threshold
  ~10–14); with dense 14-day data, auto-adaptive becomes a candidate.

## Consequences

- Folded into H9 Phase 1's PR (master plan Step 4), not a separate PR. Tier B on first
  introduction, Tier C for subsequent threshold tuning.
- SLOs are created in the Bluebox env `tgo73062` via the `levyam-bluebox` context (ADR 0030).
- The switchover points are recorded in the plan and checked every monthly cycle by the
  `obs-best-practices` skill.
- Owner touchpoint: paste tokens as repo secrets when asked.
