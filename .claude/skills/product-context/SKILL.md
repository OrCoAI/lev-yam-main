---
name: product-context
description: >
  Load the company brain before any product conversation — vision, architecture invariants,
  the current roadmap block, the facts rules (public repo: no prices, no PII), and the newest
  decisions — so scope and feature answers comply with what was already decided. Use FIRST
  whenever a conversation is about a new feature, a scope question, a "should we", a module
  idea, a public-page idea, or which phase something belongs to. Triggers: "should we",
  "what if we add", "new feature", "new module", "is this in scope", "where does this
  belong", "roadmap", "vision", "does this fit", "next initiative".
metadata:
  version: '0.1.0'
---

# Product context

Agents with organizational context comply with product decisions dramatically better than
agents with codebase access alone — undocumented (or unread) decisions are the ones that get
violated. This skill is the read step. It writes nothing.

## Load, in this order (read the files — don't recall them)

1. `docs/VISION.md` — the three circles (Operate / Create / Join), the seven principles.
2. `docs/ARCHITECTURE.md` §7 invariants (RLS everywhere; anon keys only in the browser; no
   PII/secrets/signatures in this public repo; business invariants in Postgres; HE + AR for
   everything user-facing; visibility flags on public content; live tools keep working until
   parity; `docs/ROADMAP.md` is the single tracker) and §6 (everything is a module, initiatives
   are data, shared spines).
3. `docs/ROADMAP.md` — find the **current block**: the first section whose checklist still has
   open items. Today that is *Operating system — gate into Phase 2*; **Phase 2 does not start
   before the first quarterly review** (ADR 0021). Note which phase the topic at hand belongs to.
4. `FACTS.md` — the rules only: it is the sole fact source for public content; anything else
   is `[חסר: …]` / `[مفقود: …]`; **no prices anywhere in the repo, ever**; no customer data.
5. `docs/decisions/README.md` — the index; open the **five newest ADRs** and any ADR whose
   title matches the topic (grep the index). ADRs are the reasoning; CLAUDE.md is the rule.
6. `docs/modules/<module>.md` for any module the topic touches — open bugs and ideas there
   may already cover it.

## Then answer with the context applied

- Name the **circle** (Operate / Create / Join) and the **roadmap phase** the topic serves.
- Name any invariant, principle or ADR that constrains it — quote the number, don't paraphrase.
- If the topic contradicts the vision, roadmap, architecture or an ADR: say so, cite it, and
  stop — that is the **conflict rule** (CLAUDE.md): raised with the owner, never coded around.
- If it belongs to a later phase: say which, and offer `idea-capture` (one line in
  `docs/ideas.md`) instead of elaborating.
- If it is a real initiative for the current block: hand off to `feature-spec`.

## Never

- Never invent a fact about Lev Yam (people, dates, prices, numbers) — FACTS.md or nothing.
- Never start writing code, a plan file, or a spec from inside this skill.
