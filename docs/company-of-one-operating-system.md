# The Company-of-One Operating System
### A standalone, future-proof strategy for building a serious product alone with AI agents

**Status:** v1.0 — foundation document. Instantiated per-project via the checklist in §10.
**Design goal:** survive changes in models, tools, and the product itself. Everything here is plain-text, open-standard, and tool-agnostic by construction.

---

## 1. First principles (why this works)

The evidence base (see companion research report) reduces to five laws:

1. **Judgment is the bottleneck, not execution.** Agents give a solo builder 5–10x execution. The scarce resources are your decisions, your context, and your validation. The entire system exists to make those three scale the way code now does.
2. **Context compounds.** Agents with organizational context comply with product decisions dramatically better than agents with codebase access alone (benchmark: 46% → 95%). Undocumented decisions are the ones that get violated.
3. **Decisions flow downhill only.** Vision constrains roadmap, roadmap constrains specs, specs constrain execution. Uphill flow on every cycle turns the one human into a full-time re-decider — that is the bottleneck reborn.
4. **Autonomy = safety rails.** You can remove yourself from the loop exactly to the degree the system catches mistakes without you. Tests, CI, branch protection, flags, and observability are load-bearing, not nice-to-have.
5. **Velocity without validation is the failure mode.** Shipping the wrong thing at machine speed is the #1 way solo builders lose. Validation is wired into the definition of done, not bolted on.

---

## 2. The Company Brain (single source of truth)

One repository holds the company. Agents, skills, and automations all read from it; nothing important lives only in your head or in a chat history.

```
<app-repo>/
├── CLAUDE.md               # entry point: points agents at everything below
├── docs/
│   ├── product.md          # press release, problem statement, primary persona, NON-GOALS
│   ├── constitution.md     # foundational architecture + hard rules (see §3)
│   ├── roadmap.md          # now / next / later, plain text
│   ├── ideas.md            # parking lot: date + one line, never elaborated inline
│   └── decisions/          # ADR log, 0001-*.md onward, append-only
├── .claude/
│   ├── settings.json       # tool permissions: what agents may do unattended
│   └── skills/             # the skill set (§5), versioned WITH the product
└── specs/
    └── <feature>/spec.md   # per-feature: outcome, scope, constraints, tech design, DoD
```

**Disciplines that make it real:**
- Every "actually, let's do X instead" becomes a decision entry the same day.
- A doc that contradicts reality is worse than no doc — updating docs is part of every feature's definition of done.
- Skills live in the repo (symlinked to `~/.claude/skills/`), so the brain and the judgment travel together.

---

## 3. The Constitution (foundational architecture)

Written once, early; changed only by ADR. It is the law every agent session inherits.

**Must define:**
- Stack and hosting (languages, framework, DB, deploy target)
- Security defaults: RLS on by default; secrets never in code; authz checked server-side
- API and code conventions (naming, error handling, folder structure)
- Testing strategy: tests-first is mandatory; what coverage means here
- Observability requirements: every feature ships with its telemetry
- Design language: components, tone, RTL/i18n rules if applicable
- **Hard no's:** what this product deliberately is not and will not do
- **Risk tiers** (used by Gate 2, §4):
  - **Tier A (full human review, always):** auth, payments, data migrations, RLS/policies, secrets, anything user-data-destructive
  - **Tier B (standard review):** new features, API changes
  - **Tier C (skim / auto-mergeable when green):** copy, docs, tests, refactors, dependency bumps
  - Agents must declare the tier on every PR.

---

## 4. The Operating Cadence & the Two Gates

Different layers change at different speeds. Each gets its own clock. Brainstorming lives in a parking lot, not at checkpoints.

| Clock | Ritual | Inputs | Output |
|---|---|---|---|
| **Quarterly** (or evidence-triggered) | Vision + architecture review; the one divergent brainstorm | Validated evidence, market shifts | Updated product.md / ADRs — or explicit "no change" |
| **Monthly** | Roadmap review | feedback-triage digest, analytics, ideas.md parking lot | Re-sorted now/next/later; parking lot emptied in batch |
| **Weekly** | Spec session + weekly-review report | Top roadmap item; drift check | One approved spec → **GATE 1** |
| **Daily** | Autonomous execution | Approved spec + constitution | PRs → **GATE 2** |
| **Continuous** | Release + telemetry | Merged PRs | Flagged rollout; signal back into feedback-triage |

**Gate 1 — Spec approval (before).** Spec = outcome, scope boundaries, constraints, short technical design (data model, affected components, approach), acceptance criteria, analytics events, rollback plan. Agent drafts; you edit and approve. Bug fixes and tweaks skip the spec (no sledgehammers on nuts).

**Gate 2 — PR review (after).** You review outcomes (diff + preview deploy), never keystrokes. Review depth follows the risk tier. Ready-for-review means: tests green, preview link, self-review notes, tier declared.

**Between the gates: agent territory.** No product or architecture decisions happen there. An agent hitting an unspecified question escalates (decision log / next weekly slot) — it never improvises.

**The one queue-jumper:** invalidation evidence — users demonstrably not doing what a core bet assumes — interrupts anything, immediately. Nothing else does.

---

## 5. The Skill Set (judgment, made executable)

Rule of thumb: reuse scaffolding (~80%), custom-build judgment (~20%). Reuse sources: Anthropic's official PM plugin (`anthropics/knowledge-work-plugins`, Apache-2.0) as base layer; PM-Skills collections for discovery/prioritization frameworks; large engineering skill collections for release/CI checklists. Avoid non-commercial-licensed material in a commercial workflow. The skill format is an open standard (agentskills.io) supported across Claude Code, Claude.ai, API, Codex, Cursor, Gemini CLI — this is the portability guarantee.

| Skill | Layer | Purpose | Build |
|---|---|---|---|
| `product-context` | All | Loads constitution, persona, decision log, roadmap state before any product work. The 46→95% lever. | **Custom** (it *is* you) |
| `feature-spec` | Weekly | Spec template + size threshold + definition of done (incl. analytics + rollback) | Adapt from PM plugin |
| `execution` | Daily | What a headless agent loads before code: approved spec, risk tiers, escalate-don't-improvise, Gate-2-ready PR definition | **Custom** |
| `db-changes` | Daily (Tier A) | Migration + RLS review procedure; the no-creativity zone | **Custom** |
| `release` | Continuous | Tests → changelog → deploy checklist → announcement drafts | Adapt from eng collections |
| `feedback-triage` | Monthly | Raw signal (support, reviews, analytics anomalies) → scored opportunities vs. roadmap; flags validating/contradicting evidence | Adapt from PM plugin |
| `weekly-review` | Weekly | The solo product council: shipped vs. planned, analytics pull, open decisions, **drift check** ("3 of 5 sessions were off-roadmap") | **Custom** |
| `idea-capture` | Anytime | Append idea to parking lot with date + one line, then STOP. Value = refusing to elaborate. | **Custom** (tiny) |

Skill craft rules: short SKILL.md + heavy material in adjacent reference files; aggressive, specific trigger descriptions; versioned in the repo; refined every time you catch yourself re-explaining something.

---

## 6. Connector Map (agent access to reality)

| Domain | Connector | Role in the system |
|---|---|---|
| Code & delivery | **GitHub** (+ Claude Code GitHub integration) | Source of truth; assign issue → get PR, incl. from phone; CI + branch protection live here |
| Backend | **Supabase MCP** | Schema inspection, RLS verification, queries — with product context loaded |
| Roadmap/backlog | **Linear** (or GitHub Issues for minimalism) | The PM system of record agents can read *and* write |
| Product analytics | **Mixpanel** (or PostHog/GA4) | Closes the validation loop: "did anyone use what shipped last week?" |
| Observability | **Dynatrace / Sentry-class** | Errors + performance; feeds weekly-review; every feature ships instrumented |
| Comms & ops | Gmail, Calendar, Drive | Reports delivery, scheduling reviews, doc storage |
| Marketing/data | Windsor.ai, GSC/GA4, Semrush-class | Growth loop (already established pattern) |

Principle: connectors are replaceable; the *roles* above are permanent. If a tool dies, its slot gets refilled — the strategy doesn't change.

---

## 7. Automation Layer (the night shift)

Scheduled agents (Cowork scheduled tasks / GitHub Actions crons):

- **Nightly:** dependency + security updates as Tier-C PRs; flaky test fixes
- **Per-PR (CI, blocking):** tests, lint, typecheck, security scan, preview deploy
- **Weekly (Sun evening):** weekly-review report → inbox (shipped vs. planned, drift check, analytics summary, open decisions awaiting Gate 1)
- **Monthly:** feedback-triage digest + parking-lot batch → the roadmap review agenda, pre-built
- **Guardrails (permanent):** agents cannot push to main; cannot touch prod or secrets; fully-permissive runs only inside sandboxes/containers; feature flags + one-command rollback on everything

---

## 8. The Autonomy Ladder (how trust is granted)

1. **Calibration (weeks 1–2):** agent proposes, you watch. You are learning its failure modes, not producing.
2. **Partial (weeks 3–4):** full autonomy on Tier C; supervised on features.
3. **Operational (steady state):** autonomous on everything below the spec; review depth = risk tier; Tier A always gets full human attention regardless of track record.

Autonomy is budgeted by rail strength: no real test suite → no unattended agents. Expand rails first, freedom second.

---

## 9. Health Metrics (is the system working?)

- **Drift:** % of work sessions off-roadmap (weekly-review reports it; target near zero)
- **Validation depth:** shipped-but-unvalidated features never pile deeper than one cycle
- **Cycle time:** approved spec → validated learning (not spec → merged)
- **Decision latency:** open questions waiting on Gate 1 (if growing, your weekly slot is too small — fix the slot, don't skip the gate)
- **Rework:** Tier A incidents / rollbacks (rising = autonomy outran rails)
- **Outcome, not output:** adoption/retention of shipped features — the anti-"product slop" metric

---

## 10. Instantiation Checklist (run when a real project plugs in)

1. Brain dump session → press release (Working Backwards) → product.md with persona + non-goals
2. Validate: throwaway prototype in front of 3–5 real humans; rewrite product.md from what you learn
3. Write constitution.md (stack, security, conventions, risk tiers, hard no's)
4. Stand up the repo skeleton (§2) + `.claude/settings.json` permissions
5. Install/adapt reused skills; write the four custom skills (product-context first)
6. Connect: GitHub integration, Supabase, roadmap tool, analytics, observability
7. Wire CI + branch protection + preview deploys + flags (rails before freedom)
8. Schedule the automations (§7)
9. First spec: the walking skeleton — thinnest end-to-end slice, deployed, instrumented
10. Begin the cadence at "Calibration" on the autonomy ladder

---

## 11. Future-Proofing Commitments

- Everything durable is **plain-text markdown in git** — readable by any model, any tool, any decade
- Skills follow the **open agentskills standard** — portable across vendors
- Connectors fill **roles**, and roles outlive tools
- The cadence, gates, and tiers are **model-independent** — smarter agents change how much lands in Tier C, never the shape of the system
- The human's two jobs are permanent: **approve specs, review outcomes.** Everything else is delegated by design

*Companion document: "The Product Management Bottleneck in the AI Era: Evidence and Best Practices" (research report, this session).*
