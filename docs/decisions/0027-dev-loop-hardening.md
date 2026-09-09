# 0027 — Dev-loop and access hardening

- **Date:** 2026-08-13
- **Status:** accepted — execution was paused when H9 was removed from the roadmap on 2026-08-26 (ADR 0032) and resumed when the owner reinstated H9 on 2026-09-09 (ADR 0035)
- **Decided by:** owner (strategy session with Claude Code)
- **Source:** `docs/plans/master-execution-plan.md` Part 1 #13 and Part 2 (M0.1); `docs/plans/observability-best-practices-adoption.md` phase E

## Context

Daily agent work and explicit configuration changes were sharing one Dynatrace access path.
Official guidance separates read from write, prefers platform tokens with least-privilege
scopes, and notes the OSS local MCP server is in maintenance mode.

## Decision

- **MCP:** a **platform token** (not an OAuth client) with least-privilege read scopes
  (`storage:*:read` as needed), `${VAR}` interpolation so config commits clean, and
  `DT_GRAIL_QUERY_BUDGET_GB` set to a sane guardrail (e.g. 100 GB) — "a runaway-query fuse,
  not a budget constraint".
- The OSS local MCP server's maintenance-mode status is noted; the direction is the
  Dynatrace-hosted remote MCP or dtctl-with-Agent-Skill.
- **dtctl contexts:** the default production context (`my-env`) is pinned to a **readonly**
  safety level for daily/agent use; an explicitly named **write context** is reserved for
  `dtctl apply` sessions.
- Ownership team **`levyam-solo`** (`builtin:ownership.config`) with contact routing, applied
  via tags to the edge services and frontends: "One person today; correct routing plumbing
  forever."
- Harness telemetry into Grail: Claude Code's OpenTelemetry export (usage/cost/session
  metrics only, no prompt or code content) to the working environment (detailed in ADR 0034).

## Consequences

- Tier B; lands in master plan Step 10 alongside phases A and F. The MCP choice for `.mcp.json`
  is recorded per this ADR at Step 11.
- The readonly/write split is mirrored in the permissions allowlist (ADR 0022): dtctl reads
  allowed, writes ask, `dtctl auth` denied.
- Owner touchpoint: interactive `dtctl auth login` if the session expired; auth is never
  agent-driven.
