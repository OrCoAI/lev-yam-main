# 0007 — A story page ships only when its Arabic twin exists (invariant 5 over a Hebrew-first content plan)

- **Date:** 2026-08-11
- **Status:** accepted
- **Decided by:** owner + Claude Code (kickoff, conflict rule)
- **Source:** `docs/ARCHITECTURE.md` invariant 5; `CLAUDE.md` "Stories section", "A page is a pair" bullet; `docs/plans/content-engine-phase0.md` decision P5

## Context

The content engine plan (`/stories/`, answer-first pages per query cluster) arrived with an
internal content plan that proposed Hebrew-first phasing: ship Hebrew pages now, add Arabic
later. `docs/ARCHITECTURE.md` invariant 5 already required both languages for anything
user-facing. Per the CLAUDE.md conflict rule this had to be raised and resolved explicitly,
not coded around.

## Decision

Invariant 5 wins. From the content-engine plan's decision table:

> **Conflict — bilingual invariant vs. Hebrew-first content** | `docs/ARCHITECTURE.md`
> invariant 5 ("both languages for anything user-facing") **wins**. Story pages ship HE **and**
> AR from day one; the internal plan's Hebrew-first phasing is amended accordingly. Recorded
> here and in `CLAUDE.md`.

The invariant as amended in `docs/ARCHITECTURE.md`:

> 5. Both languages (HE + AR) for anything user-facing; RTL correct in both. This binds the public
>    marketing site too, including `/stories/`: a story page ships only when its Arabic twin exists
>    (confirmed 2026-08-11, over a content plan that proposed Hebrew-first phasing). Where the
>    platform swaps text client-side, the public story pages use one URL per language plus
>    `hreflang`; both satisfy this rule.

And the working rule in `CLAUDE.md`:

> **A page is a pair.** `stories/<slug>/index.html` (Hebrew) **and** `stories/ar/<slug>/index.html`
> (Arabic), same English kebab-case slug, cross-linked with reciprocal `hreflang`. Neither ships
> alone — that's `docs/ARCHITECTURE.md` invariant 5.

## Consequences

- `scripts/gen-stories-index.mjs` enforces the twin rule: a page missing its other language
  fails the build, so the rule is mechanical rather than a review reminder.
- Story pages use one URL per language paired by `hreflang` (unlike the homepage's client-side
  swap); both models satisfy invariant 5.
- `llms.txt` and `/facts.txt` are recorded as a deliberate exemption (machine-readable crawler
  surfaces), not a silent gap.
