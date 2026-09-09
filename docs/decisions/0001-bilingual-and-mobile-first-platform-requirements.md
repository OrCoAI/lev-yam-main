# 0001 — Bilingual (HE + Levantine Arabic) and mobile-first are platform requirements from Phase 1 on

- **Date:** 2026-07-09
- **Status:** accepted
- **Decided by:** owner + Claude Code (kickoff)
- **Source:** `CLAUDE.md` "Platform" bullet "Bilingual & mobile-first are platform requirements"; `docs/ROADMAP.md` "Cross-cutting foundations"; `docs/ARCHITECTURE.md` §4 and invariant 5

## Context

The platform (`/app`) was starting Phase 1 with its first module. The marketing site was already
bilingual (HE default + Levantine Arabic, RTL), and the real users of the internal platform hold
phones: staff mid-service, members in the village, one tablet at the POS. The question at kickoff
was whether bilingual UI and a phone-first design were Phase 1 requirements or later retrofits.

## Decision

Both are requirements from the first module on, never retrofitted. The rule as recorded in
`CLAUDE.md`:

> **Bilingual & mobile-first are platform requirements** (decided 2026-07: from Phase 1 on).
> Platform UI ships in Hebrew + Levantine Arabic through the shell i18n layer — never
> hardcode one language — and is designed and tested phone-first (staff and members work
> from phones).

The roadmap's cross-cutting foundations state the same, with the reasoning for the timing:

> **Bilingual everywhere:** HE + Levantine Arabic from Phase 1, internal and public alike —
> the i18n layer lands with the first module and nothing is retrofitted

> **Mobile-first:** staff and members work from phones — test there first

`docs/ARCHITECTURE.md` §4 gives the design posture ("Design for the phone screen first;
desktop is the enlargement, not the target" and "RTL is the default reality — Hebrew and
Arabic both") and invariant 5 makes it a rule that must never break: "Both languages (HE +
AR) for anything user-facing; RTL correct in both."

## Consequences

- Every module ships its strings through the shell i18n layer (`makeDictHook` and the
  `MODULE_META` pattern became the platform standard in the mobile-UX pass).
- Localhost verification includes a mobile viewport pass; the screenshot harness later grew a
  narrow viewport (see ADR 0009).
- Modules that predate the rule (finance chrome, users) carried an HE/AR retrofit debt that was
  tracked and paid down explicitly rather than accepted.
- Invariant 5 later bound the public `/stories/` pages too (ADR 0007).
