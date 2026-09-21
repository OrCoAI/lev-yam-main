---
name: idea-capture
description: >
  Append one dated line to docs/ideas.md (the cross-cutting parking lot) and STOP — no
  elaboration, no design, no plan. For ideas that don't belong to a single module's log.
  Triggers: "park this idea", "idea:", "parking lot", "note for later", "someday".
metadata:
  version: '0.1.0'
---

# Idea capture

The value of this skill is refusing to elaborate. Brainstorming happens at the monthly
roadmap review (parking lot emptied in batch) and at the quarterly review's sanctioned
divergent slot — never at capture time (CLAUDE.md cadence, ADR 0021).

## Procedure

1. If the idea is about one live module's behaviour (a POS button, a finance column), it
   belongs in `docs/modules/<module>.md` **Open feature ideas** instead — put it there, same
   one-line format, and say so.
2. Otherwise append to `docs/ideas.md`, under the current month heading (create it if
   missing), exactly one line:
   `- YYYY-MM-DD — <one line, ≤ 140 chars> [#tag …]` — tags are optional module or circle
   names (`#pos`, `#join`, `#public-site`, `#obs`).
3. Reply with the line as written. Nothing else — no "we could also…", no options, no
   estimate. If the owner asks to elaborate, say it will be picked up at the monthly review
   and stop.

## Never
- Never write more than the one line. Never open a plan file. Never edit the roadmap.
- Never store a fact that FACTS.md would refuse (prices, personal data).
