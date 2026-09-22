# 0043 — First quarterly review (2026-Q3): every vision principle and every architecture invariant holds; "Where we are today" rewritten

- **Date:** 2026-09-22
- **Status:** accepted — the explicit no-change record required by the `quarterly-review` skill (agenda items 1 and 2)
- **Decided by:** owner (closed questions, live session on [issue #62](https://github.com/OrCoAI/lev-yam-main/issues/62))
- **Source:** issue #62 (evidence pack + refresh comment); `.claude/skills/quarterly-review/vision-audit.md` and `architecture-audit.md`

## Context

The first quarterly review is the gate into Roadmap Phase 2 ([ADR 0021](0021-operating-cadence-quarterly-gate.md)).
Its agenda walks `docs/VISION.md` claim by claim and `docs/ARCHITECTURE.md` §7 invariant by
invariant, and the skill is explicit that "an explicit 'no change' is a recorded outcome (an ADR
too), not a skipped step." This ADR is that record. The evidence is in the pack (issue #62) and its
2026-09-22 refresh; nothing here restates it.

## Decision

### Vision — all hold

| Item | Verdict | Evidence line |
|---|---|---|
| The dream ("see what's happening / create your own work") | **hold** | the quarter built the Operate floor; the frame is untested, not contradicted |
| Three circles (Operate / Create / Join) | **hold** | no triage signal for a fourth or an empty one |
| Membership by invitation; public door in Phase 6 | **hold** | invite flow exists (H5); no member yet, Phase 3 not started |
| P1 community as creators | **hold — principle stays, priority shifts** | no member evidence either way; the owner's quarter priority (ADR 0046) sequences reach before creation without changing the purpose |
| P2 everything is a module | **hold** | five module deliveries through MODULE-TEMPLATE, none bent the core |
| P3 one login, roles decide | **hold** | per-user overrides re-asked and declined again (first declined 2026-07-20) |
| P4 public by default | **hold** | no public content table exists yet; tested by Phase 2's first |
| P5 bilingual + mobile-first | **hold** | two retrofits this quarter, both named as process failures and fixed (finance chrome HE/AR; topbar at 360px — the 360 shot is now default) |
| P6 real numbers, tightly guarded | **hold** | no money visible wider than intended; per-initiative grants still to be designed in Phase 3 |
| P7 evolution, not revolution | **hold** | POS and quotes cut over only after proven parity |
| "Where we are today (July 2026)" | **amend** | factually stale (POS in the platform, quotes migrated, staging tier, edge-function tracing, operating system installed) — rewritten in `VISION.md` in the same PR |

**Quarter bets (Operating-system block):** the process half ran — tiers, decision log, skills,
automations and cadence all demonstrably operate (Tier C flowed to prod untouched twice, three crons
fired, `@claude` produced a merged PR). The observability half has no signal: the environment was
lost, not the bet tested. The owner's verdict: *"skip everything related to observability to later on,
it is not a blocker for now"* — formalised in [ADR 0045](0045-observability-home-re-deferred-to-2027-01-review.md).

### Architecture — invariants 1–8 all hold

1. RLS everywhere, UI never the only gate — every new table shipped with policies and `rls_matrix`
   assertions; the grant audit reports 0 drift on both tiers (deploy of `999a227`, 2026-09-22). Two
   escalations were found **and closed by the gate** this quarter; the invariant held because it is tested.
2. Anon keys only in the browser — no leak candidates.
3. No PII/secrets/signatures; span allow-list enforced in `otel.ts`. The second masking layer
   (OpenPipeline, H9.5-C) does not exist — parked with observability, recorded as a known gap.
4. Business invariants in Postgres — the quarter moved rules *into* Postgres (`entries_guard`,
   `expected_guard`, the category-writer predicate). One client-only derived status remains
   (quotes `isWaitingPayment`), logged in `docs/modules/finance.md`.
5. HE + AR everywhere — the story-twin rule is generator-enforced; module dictionaries complete.
6. Visibility flag on public content tables — none exist yet; n/a.
7. Live tools until parity — held (P7).
8. ROADMAP is the single tracker — two hygiene misses, both fixed in this PR: `docs/modules/users.md`
   still listed self-signup as open (done 2026-08-12), and the `pos-split-payments` close-out had no
   alignment line.

### Standing items

- **Security checklist:** `disable_signup` true on both tiers; branch protection as documented
  (`build` + `tier`, admins included). Two findings: `@simplewebauthn/server` pinned `^10.0.0` vs
  `14.0.2` on npm, invisible to dependabot (Deno import) — **deferred with a date** ([ADR 0045](0045-observability-home-re-deferred-to-2027-01-review.md) carries the 2027-01-01 re-check
  list); the break-glass account's email confirmation is **unverified** — logged as a roadmap item.
- **Capacity at 5×:** nothing breaks at today's shape (reports are set-based); the Supabase free
  tier is the ceiling, and the first anonymous public surface is what changes the load shape.
- **Ceremony audit:** gate + tiers proportionate — Tier A median ≈13 min excluding two owner
  holds, Tier C ≈7 min, Gate-2 queue 0. The one rework chain (#57 → #59 → #61 → #69) was
  CI-runtime behaviour that only live runs catch. The AI-pre-review trigger ([ADR 0034](0034-harness-engineering-alignment.md))
  is not met. **No tier changes.** Skill evals did not run this quarter — a roadmap follow-up, not
  skipped silently.
- **Observability generation:** no monthly audit ran; nothing to summarise.

## Consequences

- `VISION.md` "Where we are today" is rewritten; no principle text changes.
- `ARCHITECTURE.md` is unchanged.
- The two tracker-hygiene fixes land in this PR; `isWaitingPayment` stays a module-log item.
- Next review (2027-01-01) re-walks the same checklists; this ADR is the baseline it compares against.
