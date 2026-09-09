---
name: obs-best-practices
description: >
  Monthly observability best-practice audit for the Lev Yam platform, run as a fixed
  agenda item of the monthly product/roadmap review (and on demand). Checks the repo's
  observability implementation (Davis detector YAML, SRG config, RUM setup notes,
  dashboards-as-code, MCP/dev-loop config) against the CURRENT capabilities and official
  guidance of the two connected tools — Dynatrace and Bluebox — and proposes amendments.
  Proposes, never applies: output is a compliance diff + candidate roadmap/parking-lot
  entries for the review to decide on. Triggers: "monthly review" (as sub-step),
  "observability best practices check", "obs audit", "did Dynatrace/Bluebox change
  anything", "capability check".
compatibility: Claude Code; requires dtctl (readonly context) and bluebox CLI configured.
metadata:
  version: '0.1.0'
---

# Observability Best-Practices Monthly Audit

Dynatrace and Bluebox both ship changes monthly; this repo's observability layer is
code (YAML, workflow files, template rules) that silently ages. This skill closes that
gap on a monthly clock: inventory what we run → probe what the tools now offer →
diff against official guidance → propose. It feeds two consumers: the **monthly
review** (small amendments, threshold tuning, new-capability parking-lot entries) and
the **quarterly architecture audit** (generation shifts, deprecations, ceremony
changes).

## Hard rules

1. **Read-only against live environments.** All dtctl calls run in a readonly-safety
   context; `bluebox ask` is inherently read-only. This skill NEVER applies settings,
   never edits YAML in place, never opens PRs. It writes exactly one artifact: the
   audit section of the monthly review issue/agenda.
2. **Query-hygiene probing.** Narrow DQL timeframes (default 24h–7d), no unbounded
   `fetch spans`; respect `DT_GRAIL_QUERY_BUDGET_GB` as a runaway-query fuse. Budget
   is not a constraint in this environment — hygiene is about clean, fast, repeatable
   audits, not cents.
3. **Invariants are constraints, not suggestions.** Proposals must respect the
   ARCHITECTURE.md invariants (PII allow-list, no browser telemetry to Bluebox,
   console-side tier separation, additive-never-load-bearing) and standing owner
   decisions (no external alert channels; pos.html dark until migration). A proposal
   that conflicts with a decision is raised AS a conflict, citing the decision — never
   silently proposed as if new.

## Procedure

### 1. Inventory (repo — what we run)
Read and list, with versions/dates where present:
- Davis anomaly detector YAML files + the schema version each targets
- SRG guardian/workflow config (once H9.5-A lands) + SDLC event wiring in deploy.yml
- Synthetic monitor runbook section in the H9 plan
- RUM setup notes: RUM JS version in use, frontend definitions, masking settings
  documented in ARCHITECTURE §6b
- Dashboards-as-code YAML; SLO definitions; `.mcp.json` + MCP server flavor
  (OSS local vs hosted); dtctl version + context safety levels
- MODULE-TEMPLATE.md "Observability" checklist; the reconciliation-monitor Facts
  allow-list in `_shared/otel.ts`

### 2. Probe (live — what the tools now offer)
- `dtctl version`; `dtctl get schemas` — diff schema versions against the YAML
  inventory (a bumped `builtin:davis.anomaly-detectors` or SRG schema = migration
  candidate)
- `bluebox ask`: "What capabilities, skills, or Routine types were added or changed
  in the last month? Any deprecations announced? Any of our services outside current
  best practice?" — also verify the weekly Routine still runs and its findings
- Check installed Bluebox skills in `.claude/skills/bluebox-*` against `bluebox setup`
  current output (version drift in the skills themselves)
- RUM: confirm deployed RUM JS version ≥ the minimum for features we rely on
  (frontend-backend linking needs ≥1.329)

### 3. Official-guidance check (docs — what changed upstream)
Fetch and scan, most-recent-first, for items touching our surface area:
- docs.dynatrace.com "What's new in Dynatrace SaaS" (RUM, Davis, SRG, SLO,
  OpenPipeline, Synthetic sections)
- Dynatrace Hub release notes for: Site Reliability Guardian, Anomaly Detection,
  dtctl
- docs.bluebox.ai changelog/docs index (public docs are thin — treat repo-probed
  findings as authoritative where docs are silent, and note when public docs catch up)
- The Anomaly Detection DQL writing guide + SLO burn-rate guidance for changed
  recommendations (e.g., the count-based→rate-based switchover thresholds)

### 4. Diff & propose (output)
Produce one markdown section for the monthly review with exactly four parts:
1. **Compliance table** — each implemented item: `aligned` / `drifted (what changed)`
   / `superseded (native capability now exists)`.
2. **Traffic-threshold check** — current req/day and sessions/day vs. the documented
   switchover points (count-based SLOs → rate+burn-rate at ~hundreds/day;
   static → auto-adaptive thresholds needs 14d of dense data). State plainly:
   "still below threshold" or "threshold crossed — propose migration".
3. **Proposals** — max 5, each one line + effort guess + which H9/H9.5 phase or
   module log it belongs to. New-capability ideas that aren't urgent go to
   `docs/ideas.md` wording, not the roadmap.
4. **Queue-jumper flags** — only for: announced deprecations with dates, security
   advisories, or silent breakage discovered while probing (e.g., Routine stopped
   running, RUM tag stale). These bypass the monthly batch per the cadence rules.

## What this skill is not
Not the weekly health check (Bluebox Routine + weekly-review own that), not an
implementation vehicle (proposals become plan-file or module-log entries through the
normal kickoff/log process), and not a substitute for the quarterly architecture
audit — it feeds it.
