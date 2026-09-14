---
name: feature-spec
description: >
  Run the kickoff for a new initiative as a spec: the alignment questions, the plan file from
  the template (scope, schema/RLS/permissions, UI, open questions, OUTCOME METRIC and when it
  is checked, tier), and the roadmap / architecture / vision checks — Gate 1. Use when the
  owner opens a new initiative: a migration, a new module, a cross-module flow, a new UI
  surface, anything with real scope. Triggers: "new initiative", "new module", "kickoff",
  "let's build", "start work on", "plan the", "spec this". Not for bug fixes or small
  features on a live module (those use docs/modules/<module>.md).
metadata:
  version: '0.1.0'
---

# Feature spec (Gate 1)

The kickoff in `CLAUDE.md` ("Module work kickoff — MANDATORY") made executable. The owner
approves the spec; between Gate 1 and Gate 2 (PR review) no product or architecture decision
is taken by an agent — an unspecified question escalates, it never improvises.

Adapted from Anthropic's `product-management/write-spec` (knowledge-work-plugins,
Apache-2.0): goals / non-goals / success metrics / acceptance criteria shape; the connector
steps are dropped — this repo's context lives in `docs/`.

## 1. Load context first

Run `product-context` (VISION, invariants, current roadmap block, FACTS rules, newest ADRs).
If the initiative is not in the current roadmap block, stop and say which block it belongs
to; the roadmap decides order, the request does not (ADR 0021: Phase 2 waits for the
quarterly review).

## 2. Alignment questions — closed, one at a time (AskUserQuestion)

Ask until both sides are 100% aligned; no artifacts before that:
- **Outcome**: what number moves, for whom, by when it is checked (2–4 weeks after ship)?
- **Scope**: the thinnest end-to-end slice that proves the outcome.
- **Explicitly out of scope**: what a reasonable reader might assume is included.
- **Circle + phase**: Operate / Create / Join; roadmap phase; why now.
- **Data**: new schema? new permissions? touches the events/finance spine?
- **Surface**: which modules / public pages; bilingual HE+AR; phone-first.
- **Rollback**: how the change is undone if the outcome check fails.
- **Tier** (ADR 0015): what the changed paths will require; declare it in the plan.

Any answer that changes a standing rule becomes an ADR the same day (`docs/decisions/`).

## 3. Write the plan file

`docs/plans/<module>-<initiative>.md` from [plan-template.md](plan-template.md). Link it from
`docs/ROADMAP.md` under the right block. The **Outcome metric** section is mandatory
(work order G5): the number, its source (GA4 / Dynatrace bizevent / a DB count / a module
report), the baseline today, the check date, and who decides "validated / not".

## 4. The three checks (write the verdicts into the plan)

- **Roadmap**: current block, or added/flagged there.
- **Architecture** (`docs/ARCHITECTURE.md` §6–7): permissions DB-first via
  `core.has_permission`, schema in `supabase/schema/` as source of truth, money and lifecycle
  through the spines, bilingual via shell i18n, mobile-first, visibility flag on public tables.
- **Vision** (`docs/VISION.md`): which principle it serves; which it must not break.

A contradiction anywhere → the conflict rule: raise it, resolve it with the owner, write the
resolution back (doc + ADR). Never code around it.

## 5. Hand-off

Present the plan to the owner for **Gate 1 approval** (closed question). Only after "approved":
branch, then the pre-commit gate, tiers and staging rules in `CLAUDE.md` apply. The close-out
ritual later appends **Close-out** and, on the check date, **Outcome check** to this plan.
