# Decision log (ADRs)

Every dated decision that governs how this repo is built lives here as one file, append-only,
numbered in the order the decisions were made: `NNNN-<slug>.md`. `CLAUDE.md` keeps the rule
and links here for the reasoning; the reasoning is never repeated inline. Extracted from
`CLAUDE.md`, `docs/ARCHITECTURE.md`, the plan files and workflow comments on 2026-09-09
(work-order item G2, [plans/lev-yam-gap-analysis-work-order.md](../plans/lev-yam-gap-analysis-work-order.md)).

**The standing rule:** every "actually, let's do X instead" becomes an ADR **the same day** it
is decided — during kickoff (record the alignment answers that change a rule) and at close-out
(record what was decided along the way). A decision that only lives in a chat, a commit
message, or a plan's prose is the one that gets violated next session.

## Format

```
# NNNN — <title>

- **Date:** YYYY-MM-DD
- **Status:** accepted | superseded by NNNN | amends NNNN
- **Decided by:** owner | owner + Claude Code (kickoff / close-out / review)
- **Source:** where the decision was originally recorded (file, section, PR)

## Context
## Decision
## Consequences
```

Keep the original rationale text where it exists — quote it, don't rewrite history. Per-feature
implementation choices stay in their plan files; an ADR is for a decision that changes how
*future* work is done.

## Index

<!-- one line per ADR, newest last -->
- [0001 — Bilingual (HE + Levantine Arabic) and mobile-first are platform requirements from Phase 1 on](0001-bilingual-and-mobile-first-platform-requirements.md) — 2026-07-09
- [0002 — Supabase PITR (paid tier) deferred until 20 signed contracts](0002-pitr-deferred-until-20-signed-contracts.md) — 2026-07-10
- [0003 — Docs-only diffs run the pre-commit gate inline (diff-class scaling)](0003-docs-only-diffs-run-gate-inline.md) — 2026-07-11
- [0004 — lev-yam-staging is a deliberate, permanent second Supabase project; dev and the verify gate never run against prod](0004-staging-is-a-permanent-second-supabase-project.md) — 2026-07-28
- [0005 — Prod schema state is verified by a live grant audit on every deploy, never assumed; prod joins the migration pipeline only behind named prerequisites](0005-prod-schema-verified-by-live-grant-audit.md) — 2026-08-05
- [0006 — GA4 carries the hand-written whatsapp_click event; tier separation for GA is console-side, not code-side](0006-ga4-carries-whatsapp-click-tier-separation-console-side.md) — 2026-08-11
- [0007 — A story page ships only when its Arabic twin exists (invariant 5 over a Hebrew-first content plan)](0007-story-page-ships-only-with-arabic-twin.md) — 2026-08-11
- [0008 — UI changes are confirmed on localhost before the pre-commit gate starts (step zero)](0008-ui-confirmed-on-localhost-before-gate.md) — 2026-08-11 *(amended — see status)*
- [0009 — 360px joins the default screenshot viewport set and every shot reports horizontal overflow](0009-360px-viewport-and-overflow-report.md) — 2026-08-12
- [0010 — /code-review high and /security-review run concurrently in the gate](0010-code-review-and-security-review-run-concurrently.md) — 2026-08-12
- [0011 — The verify project skill and scripts/verify/screenshot.mjs are the gate's harness; never hand-roll a Playwright/CDP script per session](0011-verify-skill-and-screenshot-harness-are-the-gate-tooling.md) — 2026-08-12
- [0012 — Staging verification is mandatory before merging to main; pushes to staging are pre-authorized](0012-staging-verification-mandatory-before-main.md) — 2026-08-12 *(amended — see status)*
- [0013 — Platform telemetry: two Dynatrace environments stay separate; span attributes are an allow-list; telemetry is additive and never load-bearing](0013-platform-telemetry-separate-envs-allow-list-additive.md) — 2026-08-12
- [0014 — The owner is exempt from the finance module-row guards, with every such edit recorded in finance.audit_log](0014-owner-exempt-from-finance-guards-with-audit-log.md) — 2026-08-12
- [0015 — Risk tiers A/B/C replace uniform triple sign-off](0015-risk-tiers-abc.md) — 2026-08-13 *(amended — see status)*
- [0016 — Extract dated decisions into an ADR log; slim CLAUDE.md](0016-decision-log-extraction.md) — 2026-08-13
- [0017 — Product-side skill set joins the engineering skills](0017-product-skill-set.md) — 2026-08-13
- [0018 — Automation layer: @claude action and scheduled review issues](0018-automation-layer.md) — 2026-08-13
- [0019 — Outcome metrics close the validation loop](0019-outcome-metrics-validation-loop.md) — 2026-08-13
- [0020 — Mechanical rails: branch protection, money-math tests, lint](0020-mechanical-rails.md) — 2026-08-13 *(amended — see status)*
- [0021 — Operating cadence; first quarterly review gates Phase 2](0021-operating-cadence-quarterly-gate.md) — 2026-08-13
- [0022 — Agent permissions allowlist; settings file is Tier A forever](0022-agent-permissions-allowlist.md) — 2026-08-13 *(amended — see status)*
- [0023 — Site Reliability Guardian supersedes hand-rolled deploy verification](0023-srg-deploy-verification.md) — 2026-08-13
- [0024 — Davis detector and SLO hardening to Jan-2026 guidance](0024-detector-slo-hardening.md) — 2026-08-13
- [0025 — OpenPipeline ingest-time masking as PII layer 2](0025-openpipeline-ingest-masking.md) — 2026-08-13
- [0026 — New RUM Experience frontends for both surfaces](0026-new-rum-experience-frontends.md) — 2026-08-13
- [0027 — Dev-loop and access hardening](0027-dev-loop-hardening.md) — 2026-08-13
- [0028 — Query hygiene codified as defaults, not constraints](0028-query-hygiene-codified.md) — 2026-08-13
- [0029 — Production observability home stays; no tenant migration](0029-observability-home-stays.md) — 2026-08-13 *(superseded)*
- [0030 — Bluebox-env write access is Claude Code's task](0030-bluebox-env-write-access.md) — 2026-08-13 *(amended — see status)*
- [0031 — Capability confirmation is in-flow before building SRG](0031-capability-confirmation-in-flow.md) — 2026-08-13 *(amended — see status)*
- [0032 — H9 (observability coverage) removed from the roadmap](0032-h9-observability-coverage-removed-from-roadmap.md) — 2026-08-26 *(superseded)*
- [0033 — Overpaying an expectation is allowed with a stated reason stamped into the entry note](0033-overpay-allowed-with-stated-reason.md) — 2026-08-26
- [0034 — Harness-engineering alignment](0034-harness-engineering-alignment.md) — 2026-09-09
- [0035 — H9 reinstated through the master execution plan; an "Operating system" roadmap block gates Phase 2](0035-h9-reinstated-operating-system-block.md) — 2026-09-09
- [0036 — Agent-instruction files are one "leash" class, all Tier A](0036-agent-instruction-files-are-the-leash.md) — 2026-09-09
- [0037 — ADR 0020's tooling assumptions corrected at kickoff: oxlint (TypeScript 7 blocks typescript-eslint) and the real money-math test target](0037-oxlint-while-typescript-7-blocks-eslint.md) — 2026-09-09
- [0038 — A new dedicated Dynatrace environment becomes the observability home; the sprint environment is gone](0038-new-dedicated-dynatrace-environment.md) — 2026-09-14
