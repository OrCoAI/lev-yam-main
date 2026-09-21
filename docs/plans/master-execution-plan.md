# MASTER EXECUTION PLAN — Close Phase 1, Open Phase 2
## Complete session handoff for Claude Code · lev-yam-main · 2026-08-13 · FINAL v1.1

> ## Part 3 progress (running checklist — updated as steps land)
>
> | # | Step | Status | PR / notes |
> |---|---|---|---|
> | 0 | M0 environment access + capability confirmation | **done 2026-09-14 — with a plan-changing verdict** | Logins landed 2026-09-09. **`pzh8968h.sprint` is DEACTIVATED** (marketing RUM tag 404 on prod); `tgo73062` gives the owner no read/write scopes. Owner decision: **a new dedicated Dynatrace environment is the home** ([ADR 0038](../decisions/0038-new-dedicated-dynatrace-environment.md)); Steps 4/7/8/10 and parts of 9/11 start from its own Phase 0 once the owner hands over the URL. Full verdict table in the H9.5 plan |
> | 1 | Branch protection + decision log + CLAUDE.md slim + `AGENTS.md` | **done 2026-09-09** | PR #50 merged. Branch protection live (PR + `build` check, admins included); 35 ADRs; CLAUDE.md 330 → 188 lines (Step 2 adds the tiers section) |
> | 2 | Risk tiers + permissions allowlist | **done 2026-09-09** | PR #51 (Tier A, owner-approved). `scripts/check-tier.mjs` + `tier.yml` (second required check), PR template, committed `.claude/settings.json`, ADR 0036 leash class. From here every PR self-declares a tier |
> | 3 | vitest + lint | **done** (PR #52) | two kickoff corrections, see [ADR 0037](../decisions/0037-oxlint-while-typescript-7-blocks-eslint.md): oxlint replaces eslint, and `finance/reconciliation.ts` is a hook over an RPC, not pure math — test target re-scoped |
> | 4 | H9 Phase 1 + H9.5-B | **blocked** | **parked**: the observability home is a deferred decision ([ADR 0041](../decisions/0041-observability-home-deferred-to-first-quarterly-review.md)); this step re-scopes once the quarterly review settles it |
> | 5 | Product skills | **done** (PR #54, pulled ahead of the blocked Step 4) | six skills + evals, `docs/ideas.md`; obs-best-practices eval added; scaffolding adapted from Anthropic's PM plugin (write-spec, synthesize-research; Apache-2.0) |
> | 6 | Automations | **shipped; acceptance deferred to after the quarterly review** | `claude.yml` + three crons over one `agent-report.yml` worker + dependabot Tier-C auto-merge ([ADR 0039](../decisions/0039-dependabot-auto-merge-scope.md)). Key is in. Three acceptance dispatches (2026-09-21) fixed two real bugs (#59, #61) then all failed identically at ~200 ms, $0, no model call, no error text — an API-side rejection before billing; **owner to check the Anthropic console for credits/payment method**. Cadence runs by hand meanwhile (Q3 pack = #62). G4.3's GA4-download branch is not built (no credentials; the monthly issue asks for a paste-list, G4.3's own fallback) |
> | 7 | H9 Phase 2 + H9.5-D | **blocked** | `/app` RUM needs the new Dynatrace environment (ADR 0038) |
> | 8 | H9.5-C masking | **blocked** | OpenPipeline processors need both environments to exist (ADR 0038) |
> | 9 | H9 Phase 3 | **partial — two items unblocked** | **Unblocked, no Dynatrace needed: `deno check` in `ci.yml`, and the rate limit on `login/options`** (a pre-auth amplification vector). Blocked on B1: reconciliation-as-monitor's alert, the log-attribute fix, traceparent/CORS RUM linking |
> | 10 | H9 Phase 4 slot + H9.5-A/E/F | **blocked except a docs carve-out** | SRG guardian, dashboards-as-code and the SDLC ingest token need the new environment (ADR 0038). Unblocked: H9.5-F query-hygiene rules + H9.5-A's deployment-marker note correction, both docs-only |
> | 11 | H9 Phase 5 + G5 | **partial** | G5's **template half** shipped, ahead of H9 P5 and carrying P5's telemetry bullet — [ADR 0040](../decisions/0040-g5-ships-ahead-of-h9-phase-5.md) amends ADR 0019's sequencing and is **flagged for owner confirmation**. G5's acceptance (next initiative ships with a named metric) opens with the first Phase 2 initiative. Of H9 P5: telemetry bullet delivered; production-context step + CLAUDE.md standing rule **unblocked and pending**; only the Dynatrace MCP entry needs B1 |
> | 12 | Cadence + close-outs | **cadence shipped; close-outs pending B3** | Operating cadence + queue-jumper rule + session hygiene are in CLAUDE.md. The close-outs wait on the steps they would close; G7's own acceptance requires the **first quarterly review** (B3), owner judgment, never run unattended |
>
> **Kickoff 2026-09-09 — conflicts found and resolved with the owner** ([ADR 0035](../decisions/0035-h9-reinstated-operating-system-block.md)):
> H9 had been removed from the roadmap on 2026-08-26 while this plan builds on it → **reinstated**;
> Phase 1 + 1.5 were already closed → this plan is tracked as the roadmap's **"Operating system —
> gate into Phase 2"** block and its Part 4 criteria close *that block*; the missing fifth file
> (`obs-best-practices` skill) was recovered from the owner's bundle. Standing interpretation for
> Part 1: every CLAUDE.md dated decision migrates; from plan files only owner-level policy
> decisions migrate (per-feature choices stay in their plans).
>
> ### BLOCKED — waiting on the owner (2026-09-21)
>
> **B1 is deferred, not pending** (ADR 0041, 2026-09-21) — it became an agenda item rather than a
> chore. **B3 is no longer gated on B2:** the Q3 evidence pack was assembled by hand and is
> [issue #62](https://github.com/OrCoAI/lev-yam-main/issues/62), so the review can run on 2026-09-22
> regardless. B2 is now an API-account check, not a repo task.
>
> Every remaining **step** is parked behind one of the three things below, all of which need a person.
> Two things are *not* blocked and are simply next: **Step 9's unblocked half** (`deno check` in
> `ci.yml`, and the rate limit on `login/options` — a pre-auth amplification vector, pure
> edge-function work) and the **docs carve-outs** in Steps 10 and 11. Part 4's closure criterion 2
> — a Tier-C change flowing to production with zero owner interactions — needs no blocker cleared
> either; it needs a Tier-C change to happen and be observed.
>
> | # | Blocker | Unblocks | How |
> |---|---|---|---|
> | **B1** | ~~The new Dynatrace environment~~ — **DEFERRED to the first quarterly review** ([ADR 0041](../decisions/0041-observability-home-deferred-to-first-quarterly-review.md)) | Steps 4, 7, 8, 10 and the blocked parts of 9 and 11 are **parked**, not waiting | Nothing to do now. It is agenda item 3 at the quarterly review: a cost-and-commitment decision (which tenant, which licence, what running two Dynatrace environments plus Bluebox means for a company of one), taken on evidence rather than to unblock a checklist. `quarterly-prep.yml` will surface it automatically — ADR 0038's Status now carries `deferred — first quarterly review` |
> | **B2** | ~~`ANTHROPIC_API_KEY` as a repo secret~~ **added 2026-09-21** → now: **the API account behind it** | Step 6's acceptance | Every dispatch fails in ~200 ms with `is_error: true`, $0, no model call, no error text — nothing is billed, so the request is rejected before it runs. Most plausible: **no credits / payment method on the Anthropic API account**. Owner checks the console; then one `workflow_dispatch` of `quarterly-prep.yml` is the test. Two real bugs were already fixed on the way (#59, #61) — this is not a code fault |
> | **B3** | **The first quarterly review** | Step 12's close-outs, Part 4 closure, the B1 decision, and Phase 2 itself | Owner judgment, 2–3 hours, **never run unattended** (ADR 0021). `quarterly-prep.yml` assembles the evidence pack; **B2 is now its only gate** — the old "wait for B1 first" circle is cut by ADR 0041, and the pack reports the missing observability evidence instead of waiting for it |
>
> **A live production finding is riding on B1:** the marketing RUM tag on levyam.com has returned
> 404 since some time after 2026-08-12, so all Dynatrace RUM and bizevents are dead. GA4 and Meta
> still carry the WhatsApp CTA, so the funnel is not blind. The dead tag stays until the new
> environment exists — owner decision, ADR 0038.

**Mission:** execute everything defined in the 2026-08-13 strategy session so that
(1) the Company-of-One operating system is fully installed in this repo,
(2) observability is migrated, hardened, and current-generation per official best practice,
(3) automations, skills, permissions, and cadence all run — and then
(4) **Phase 1 of the project is closed and Phase 2 opens with the first quarterly review as its opening act.**

---

## Owner's TL;DR (read this; everything below is for Claude Code)

**What this session built:** a complete operating system for a company of one. Your judgment
gets encoded into documents, skills, and gates so agents can execute at full speed while you
make only the decisions that actually need you: **approve specs (Gate 1), review outcomes
(Gate 2), and one judgment session per quarter.**

**The decisions, in one breath:** risk tiers A/B/C replace sign-everything (Tier C ships to
prod on green with zero interactions; Tier A — schema, auth, money, workflows, permissions —
always gets your full eyes) · decisions become ADRs in `docs/decisions/`, CLAUDE.md slims ·
seven product skills + a monthly observability-audit skill join your five engineering ones ·
automations: @claude issue→PR from your phone, weekly/monthly/quarterly issues auto-generated (weekly now also reports harness health — agent cost, time-to-merge, rework) ·
a ~45-rule permissions allowlist makes routine sessions zero-prompt (merges, prod pushes,
Dynatrace writes, deletions still ask) · mechanical rails first: branch protection, money-math
unit tests, lint · deploy verification goes native (Site Reliability Guardian + SDLC events;
Bluebox investigates failures) · observability hardened to current-generation official guidance
(H9.5), folded into H9's existing phases · your working Dynatrace environment stays — no
migration, budget unconstrained, cost rules are hygiene only.

**What to expect:** during execution you're needed ~5 times (interactive logins, one GitHub
setting, pasting a few secrets). After: a Sunday weekly-review issue (with drift check and an
alerts line), a monthly review agenda pre-built (feedback digest + ideas batch + obs audit),
and once a quarter a 2–3 hour session on an agent-prepared evidence pack. First two weeks
after tiers land = calibration: watch Tier-B PRs closely while trust builds.

**Things worth knowing:** (1) the permissions file `.claude/settings.json` is Tier A forever —
an agent never silently edits its own leash. (2) Alerts live inside Dynatrace/Bluebox by your
decision; the weekly report guarantees weekly eyes — if that proves too slow, that's the
pre-logged trigger for adding email. (3) Full zero-prompt autonomy lives only in ephemeral CI
(@claude runs), never on your laptop. (4) Bluebox is preview-stage; the monthly skill watches
for capability/deprecation drift so you don't have to. (5) Only one thing interrupts the
cadence: evidence that a core bet is wrong. Everything else waits its turn — that's the
system working, not the system failing.

**Phase 1 is closed** when the 12 steps are merged, a Tier-C change demonstrably flows to
production untouched, all three crons have fired, and the environment shows green monitors,
armed detectors, evaluating SLOs, and one real SRG verdict. **Phase 2 opens** with the first
quarterly review — evidence pack auto-assembled, your judgment session, output written into
ROADMAP.md as the mandate.

**The handoff:** place the five files per the table below, then in Claude Code:
*"Read docs/plans/master-execution-plan.md and execute it, starting with Part 1's ADR
migration and workstream M0."*

**How to use this document:** this is the execution spine. Four companion documents carry the
detail; place all five in the repo before starting:

| File | Repo destination | Role |
|---|---|---|
| `company-of-one-operating-system.md` | `docs/` | The strategy — principles, gates, cadence, autonomy ladder. Reference, not tasks. |
| `lev-yam-gap-analysis-work-order.md` | `docs/plans/` | Work items G1–G8 + H9 coordination (Part 4). Detailed instructions + acceptance per item. |
| `observability-best-practices-adoption.md` | `docs/plans/` | H9.5 phases A–F. Folds into H9's PRs as specified. |
| `obs-best-practices-SKILL.md` | `.claude/skills/obs-best-practices/SKILL.md` | The monthly observability audit skill. |
| This file | `docs/plans/master-execution-plan.md` | Sequence, session decisions, owner touchpoints, closure criteria. |

**Standing rules during execution:** the existing CLAUDE.md pre-commit gate applies to every
step (docs-only items use the inline carve-out). After Step 2 lands, the new risk tiers apply
to everything that follows, including this plan's own PRs — each PR declares its tier. The
conflict rule is in force: anything here that contradicts a repo doc is raised, not coded around.

---

## Part 1 — Session decisions (migrate these into `docs/decisions/` as ADRs during Step 1)

All decided 2026-08-13 with the owner:

1. **Risk-tier system (A/B/C)** replaces uniform triple sign-off; tier declared per PR,
   checked against changed paths in CI. (Work order G1)
2. **Decision log extraction**: dated decisions move from CLAUDE.md prose to `docs/decisions/`
   ADRs; CLAUDE.md slims to pointers. (G2)
3. **Product-side skill set**: product-context, feature-spec, weekly-review, feedback-triage,
   idea-capture, quarterly-review (+ the obs-best-practices monthly audit skill). (G3)
4. **Automation layer**: @claude GitHub Action; weekly / monthly / quarterly-prep crons as
   GitHub issues; dependabot PRs become Tier C auto-merge. Weekly report carries an
   "Alerts & problems" line reading Dynatrace problems + Bluebox Routine findings —
   platform-internal alerting stays the rule; this is the weekly-eyes guarantee. (G4)
5. **Outcome metrics** join the plan template + close-out ritual ("shipped-but-unvalidated
   never deeper than one cycle"). (G5)
6. **Mechanical rails**: branch protection on `main`, vitest on pos/finance money-math,
   lint in CI (eslint as written; oxlint in practice — ADR 0037). (G6)
7. **Operating cadence** (weekly/monthly/quarterly + queue-jumper rule) codified in CLAUDE.md;
   **the first quarterly review is the gate into Roadmap Phase 2 and its opening act**. (G7)
8. **Agent permissions allowlist** (`.claude/settings.json`, acceptEdits + allow/ask/deny);
   the settings file itself is Tier A forever. (G8)
9. **SRG supersedes hand-rolled deploy verification**: lifecycle guardian + SDLC events;
   `bluebox ask` becomes the on-failure investigator. H9's "no deployment-marker API" note
   corrected (Bluebox-only). (H9.5-A)
10. **Detector/SLO hardening to Jan-2026 guidance**; count/freshness SLOs stay until the
    documented traffic thresholds; switchover points recorded and checked monthly. (H9.5-B)
11. **OpenPipeline ingest-time masking** as PII layer 2 in both environments. (H9.5-C)
12. **New RUM Experience frontends** + RUM JS ≥1.329 for both surfaces. (H9.5-D)
13. **Dev-loop hardening**: platform tokens, readonly dtctl context for daily work, low
    Grail query budget, ownership team `levyam-solo`, OSS-MCP maintenance-mode noted with
    hosted-MCP/dtctl as the direction. (H9.5-E)
14. **Query hygiene codified** — clean, narrow, repeatable queries as defaults; budget is not a constraint in this environment. (H9.5-F)
15. **REVISED (owner, 2026-08-13) — SUPERSEDED 2026-09-14 by [ADR 0038](../decisions/0038-new-dedicated-dynatrace-environment.md) (tenant deactivated; new dedicated environment):** the production observability home **remains the
    current working environment** (`pzh8968h.sprint`) — owner has full access and
    unconstrained budget there. **No tenant migration.** Existing RUM tag, bizevents,
    baselines, and env references all stand. Bluebox env (`tgo73062`) stays separate
    per ARCHITECTURE §6b.
16. **Bluebox-env write access is Claude Code's task**: establish a dtctl context
    against `tgo73062` for SLO/alert objects (owner assists with interactive auth only).
17. **Capability confirmation is in-flow** (Step 0.2): confirm SRG, Workflows, and
    OpenPipeline SDLC ingest are enabled in the working environment before building
    H9.5-A (expected yes; H9 Phase 4's original mechanism remains the documented
    fallback if not).
18. **Harness-engineering alignment (owner, 2026-09-09):** (a) weekly report gains a
    **Harness health** line — cost/tokens per merged PR, time-to-merge by tier, rework
    rate, Gate-2 queue depth — fed by Claude Code OpenTelemetry export into the working
    Dynatrace environment (G3.3, G4.2, H9.5-E); this data decides the deferred AI
    pre-review and tier promotions. (b) `feedback-triage` treats all ingested text as
    data, never instructions (G3.4). (c) Session hygiene rules in CLAUDE.md: one spec
    per session, review/test as subagents, compact at checkpoints (G7). (d) `AGENTS.md`
    pointer at repo root (G2). (e) Every custom skill ships with a 3-case eval (G3).
    **Deferred, with triggers:** AI pre-review at Gate 2 (trigger: rising decision
    latency / queue depth in the weekly report); context/decision graph (trigger: ADR
    count > ~40 or product-context visibly diluting) — both go to `docs/ideas.md`.

---

## Part 2 — Workstream M0: environment access & capability confirmation

*Runs first. No migration — the working environment (`pzh8968h.sprint`, dtctl context
`my-env`) stays the observability home with full access and unconstrained budget. H9
Phase 0's baselines (~8 CTAs, ~27 sessions/day) remain valid for detector tuning.*

**M0.1 — Contexts & auth** *(owner-assisted: interactive logins only)*
- Confirm the existing `my-env` context is authenticated (re-run `dtctl auth login` if the
  session expired — owner interactive). Add an explicitly-named **write context** for
  `dtctl apply` sessions; the default context stays **readonly** for daily/agent use.
- **Bluebox's env (`tgo73062`)**: create dtctl context `levyam-bluebox`; owner completes
  the interactive auth. This resolves H9 open question 4 and unblocks SLO/alert object
  creation there (H9.5-A/B).

**M0.2 — Capability confirmation** *(gates H9.5-A; ~5 minutes)*
- In the working environment, confirm enabled: SRG app; Workflows; OpenPipeline SDLC
  ingest (`events.sdlc`); synthetic HTTP monitors + outage handling; Davis anomaly
  detectors schema. Record verdicts in the H9.5 plan. Expected all-yes given full access;
  any gap → the documented fallback applies and is logged as a follow-up, not a blocker.
- Fix the Bluebox dashboard-listing 403 (H9 Phase 0 leftover — blocks H9 Phase 4
  dashboards only).

**M0 acceptance:** both contexts work (readonly default confirmed; write context named);
`tgo73062` write path confirmed; capability verdicts recorded; the 403 resolved or ticketed.

---

## Part 3 — Master execution sequence

Each step = one or more PRs through the gate. Owner touchpoints marked **[OWNER]** —
everything else is Claude Code solo.

| # | Step | Source | Owner touchpoints |
|---|---|---|---|
| 0 | **M0 environment access + capability confirmation** (Part 2) | this doc | **[OWNER]** interactive `dtctl auth login` (as needed, both envs) |
| 1 | Branch protection on `main` + decision-log extraction (incl. Part 1 ADRs) + CLAUDE.md slim + fix stale `.claude/` housekeeping line | G6.1, G2 | **[OWNER]** confirm branch-protection setting in GitHub UI (or grant admin `gh` scope) |
| 2 | Risk tiers (CLAUDE.md + path-check script in CI) + `.claude/settings.json` permissions allowlist | G1, G8 | — |
| 3 | vitest on the pure money math + lint in `ci.yml` (targets corrected at kickoff — ADR 0037) | G6.2–3 | — |
| 4 | H9 Phase 1 **with H9.5-B folded in**: synthetic monitors, hardened detectors ("alert on missing data", 1m interval, service user), Grail-generation count/freshness SLOs (created in `tgo73062` via the `levyam-bluebox` context), Bluebox weekly Routine | H9 P1 + H9.5-B | **[OWNER]** paste tokens as repo secrets when asked |
| 5 | Product skills: product-context, feature-spec, idea-capture (+ `docs/ideas.md`), weekly-review, feedback-triage, quarterly-review (+ audit checklists); install obs-best-practices skill; adapt reusable scaffolding from Anthropic's PM plugin (Apache-2.0) where it fits | G3 | — |
| 6 | Automations: @claude GitHub Action; weekly cron (report incl. Alerts & problems line); monthly cron (triage digest + parking-lot batch + **obs-best-practices audit section**); quarterly-prep cron; dependabot→Tier-C auto-merge | G4 | **[OWNER]** add Anthropic API key secret |
| 7 | H9 Phase 2 **with H9.5-D folded in**: `/app` RUM as second New-RUM frontend, error reporting, masking, staging exclusion; rewrite ARCHITECTURE §6b truthfully | H9 P2 + H9.5-D | — |
| 8 | H9.5-C: OpenPipeline masking processors in both envs (Notebook-validated); invariant-3 doc update | H9.5-C | — |
| 9 | H9 Phase 3: reconciliation-as-monitor, log-attribute fix, traceparent/CORS linking (validated on staging), `deno check` + rate-limit follow-ups | H9 P3 | — |
| 10 | H9 Phase 4 slot, **H9.5-A mechanism**: lifecycle guardian + SDLC event from `deploy.yml` (non-blocking verdict first), Bluebox-ask as on-failure investigator; dashboards-as-code; H9.5-E (MCP/platform tokens, `levyam-solo` ownership, query budget) + H9.5-F cost rules | H9 P4 + H9.5-A/E/F | **[OWNER]** SDLC-ingest token secret |
| 11 | H9 Phase 5: Dynatrace MCP in `.mcp.json` (per the E-hardening ADR), production-context step mandatory in CLAUDE.md, instrumentation-by-default + outcome-metric fields in MODULE-TEMPLATE (G5 lands here, on top of H9 P5 — single edit) | H9 P5 + G5 | — |
| 12 | Cadence section in CLAUDE.md (G7); close out every plan file touched (close-out ritual applies to this plan too) | G7 | — |

**Autonomy note:** Steps 0–2 run under the current (pre-tier) process. From Step 3 onward,
tiers + the allowlist apply — Claude Code self-declares tiers and proceeds accordingly;
the autonomy-ladder calibration period runs concurrently (first two weeks: owner watches
Tier-B PRs closely; Tier-A always full review).

---

## Part 4 — Phase 1 closure & the quarterly kickoff (Phase 2's opening act)

**Phase 1 is closed when all of these are true:**
1. Steps 0–12 merged; every acceptance criterion in the work order (G1–G8), H9 (Phases 1–5),
   and H9.5 (A–F) met; all plan files carry close-out summaries with alignment verdicts.
2. A routine Tier-C change demonstrably flows request→production with zero owner
   interactions; a `supabase/` diff demonstrably still requires all checkpoints.
3. The three cron automations have each produced at least one real issue
   (`workflow_dispatch` counts); @claude has produced at least one PR from an issue.
4. The working environment shows: green synthetic monitors, armed detectors, SLOs evaluating,
   both dashboards rendering, and one SRG verdict recorded from a real deploy.
5. `docs/ROADMAP.md` Phase 1 / 1.5 items ticked, with discovered follow-ups logged.

**Then — the first quarterly review, which IS the start of Phase 2:**
1. Trigger `quarterly-prep.yml` (manual dispatch) → the `Quarterly review 2026-Q3` issue
   with the full evidence pack (close-outs, weekly trends, triage digests, the new
   dashboards, ideas parking lot).
2. **[OWNER]** blocks 2–3 hours: vision audit (hold/amend/retire per principle) →
   architecture audit (invariants, tech debt, security checklist, ceremony audit) →
   the sanctioned divergent brainstorm → converge.
3. Outputs merged: VISION/ARCHITECTURE amendments (or explicit no-change ADRs),
   **Phase 2 priorities written into ROADMAP.md** — this is the Phase 2 mandate.
4. First item of Phase 2 begins through the full loop: feature-spec skill → plan file
   with outcome metric → tiered execution → SRG-verified deploy → outcome check.

From that moment the operating system is self-sustaining: weekly reports watch the week,
monthly reviews absorb ideas and audit best practices, quarterly reviews steer — and the
owner's job is two gates and one judgment session per quarter.
