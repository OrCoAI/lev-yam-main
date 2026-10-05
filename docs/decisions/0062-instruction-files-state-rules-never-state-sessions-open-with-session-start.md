# 0062 — Instruction files state rules, never present repo state; sessions open with `session-start`, which derives the board

- **Date:** 2026-10-04
- **Status:** accepted. Amends [0017](0017-product-skill-set.md): a seventh product skill joins the set.
- **Decided by:** owner + Claude Code (session, 2026-10-04)
- **Source:** the owner's question "what is the way of starting a new session based on the roadmap and open items? do we have a skill for that?"; `.claude/skills/product-context/SKILL.md` step 3 and `CLAUDE.md` "Where this is going" as found that day; the `/simplify` altitude pass on the first draft

## Context

`docs/ROADMAP.md` has said since it existed that "each work session should start by reading
this file and end by updating it." The start half had no executable form. What a session needs
to know is spread over six places — the roadmap's current block, the plan files' outcome checks
(ADR 0019), the module logs, open PRs, a branch mid-verification on `staging`, the weekly and
monthly issues — and the two nearest skills each miss half: `product-context` loads the brain
but assumes a topic is already on the table; `weekly-review` lists what is open inside a full
report with analytics and alerts, too heavy for every morning.

The sharper finding: `product-context` step 3 read *"Today that is Operating system — gate into
Phase 2; Phase 2 does not start before the first quarterly review."* That block closed on
2026-09-22 (ADR 0046). For twelve days every session that trusted the skill started from the
wrong block. The skill said how to find the current block **and then said which one it was**;
the second sentence outlived the first. The altitude review of the fix found the same sentence
in nine more instruction lines: `CLAUDE.md` ("Current work: the Operating system block"; "the
automation is built but not yet live" — live since 2026-09-21; "the first quarterly review is
the gate into Phase 2", future tense), `feature-spec` ("Phase 2 waits for the quarterly review" —
which would have stopped the next kickoff), `quarterly-review`'s description (loaded into every
session's skill list), two eval expectations, and two workflow prompts.

The first draft of the fix also rested the derivation rule on an undocumented marker: a block
with ✅ in its heading is closed. Two of five closed blocks carry it; the deferred internal half
of Phase 2 carries *(internal half deferred …)* instead, so once the Q4 list is ticked the naïve
rule would have named a deferred block as current. And the rule was written into three files.

## Decision

1. **Instruction files carry rules and pointers, never claims about present repo state.**
   `CLAUDE.md`, `.claude/skills/**`, eval expectations and workflow prompts say *how to find*
   state — the roadmap, an ADR's Status line, a command — not what it is. "Today the block is
   X", "not yet live", "waits for the review" are the shapes to refuse. A dated fact is written
   as a past-tense pointer ("live since 2026-09-21, ADR 0042"), which cannot go stale.

2. **The roadmap defines its own vocabulary, once** — the **Blocks** rule in `docs/ROADMAP.md`'s
   "How we work" paragraph. The reasoning behind its shape, which is what this record keeps:
   *top-level* items only, because Phase 1 — finished but without a ✅ — would otherwise qualify
   on one deferred sub-item; heading markers (✅, *deferred*, *parallel track*) rather than
   "every item ticked", because two of five closed blocks carry a ✅, the deferred half of Phase 2
   carries neither, and a lane can hold unticked lines indefinitely; a lane's line counts as
   current only on the line's own evidence, because the real lane holds items marked *optional*,
   *out of* the mandate, or dated to the next review. The skills cite the rule by name; none
   restates it — this ADR included.

3. **A read-only `session-start` skill opens every session.** It runs `product-context`, builds
   a board from commands run now, and ends in one closed question that picks the single item the
   session is (CLAUDE.md "Session hygiene"); the chosen item's own flow — `feature-spec`, the
   module-log flow, the outcome-check verdict — does the writing. Its sections and its ranking
   are the skill's to evolve; the ranking's order is the operating cadence's (the queue-jumper
   rule, then a due outcome check, then the block's in-progress item, then the next unstarted
   one in the owner's order). Parked steps and `docs/ideas.md` are never offered — only
   invalidating evidence interrupts (ADR 0021), and the monthly review empties the lot.

## Consequences

- `.claude/skills/session-start/` ships `SKILL.md` and a 3-case `EVALS.md`; the quarterly
  ceremony audit globs it with the rest. Its commands are the allowlist's as written (`git
  status` without flags, `date -u +%F` never as an assignment — both forms the first draft got
  wrong), so a session opens without a prompt; a query needing another command changes
  `.claude/settings.json` in the same PR (ADR 0022). `feature-spec` step 1 skips its brain load
  when `session-start` opened the session.
- The sweep in the same PR: `CLAUDE.md` (three sentences rewritten, the time-boxed "Calibration"
  note removed, the Automations bullet gains the rerun-comments-on-the-existing-issue clause),
  `product-context` step 3 and eval 1, `feature-spec` step 1 and eval 1, `quarterly-review`'s
  description and agenda step 5, `weekly-review/queries.md` §3's n/a line. **Left for their own PR**, since
  `.github/workflows/` is a deployed surface with the full gate and staging verification:
  `monthly-triage.yml`'s prompt line "an empty list is the expected result until the first
  Phase 2 initiative ships" (two initiatives have shipped; the line primes the 2026-11-01 agent
  to under-report the one list that must never pile up) and `quarterly-prep.yml`'s header
  comment.
- The night-shift publisher de-duplicates by exact title under the label (`agent-report.yml`),
  so a rerun comments on the existing issue; that fact now lives in `CLAUDE.md` "Automations",
  where the publisher is described, and the skill reads an issue's comments before calling a run
  missed. Recorded because it looked like a missed run when found.
- Leash class, Tier A (ADR 0036): the owner reviews every change to the skill in full.
