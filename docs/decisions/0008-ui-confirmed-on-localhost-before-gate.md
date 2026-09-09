# 0008 — UI changes are confirmed on localhost before the pre-commit gate starts (step zero)

- **Date:** 2026-08-11
- **Status:** accepted — amended by ADR 0015 (risk tiers): from Tier B on, the human look moves to staging only; Claude's own screenshots remain step zero
- **Decided by:** owner + Claude Code (review)
- **Source:** `CLAUDE.md` "Pre-commit quality gate", paragraph "Step zero — UI confirmed on localhost before the gate starts (decided 2026-08-11)" and its Rationale

## Context

The lighter bug-fix flow already had a step 4: list every change for the user to confirm by
hand on localhost before the gate. Initiative work had no such step, so a UI change could go
through the full multi-agent gate and then be rejected on look alone. Two blind UI regressions
had already shipped because visual verification was believed rather than done.

## Decision

Quoted from `CLAUDE.md`:

> **Step zero — UI confirmed on localhost before the gate starts (decided 2026-08-11).**
> For any diff with user-visible UI changes — marketing site, `/stories/`, or the platform —
> the gate does not begin until the change is confirmed on localhost, in this order:
>
> 1. Claude verifies the change visually first with headless-Chrome screenshots at both
>    viewports [...]
> 2. Claude gives the user the exact serve command (`python3 -m http.server 8080` for
>    static pages, `cd app-src && npm run dev` for the platform) and, per change, what to
>    open/click to see it working.
> 3. The user confirms it looks right. **Only then does the gate below run.**
>
> Rationale: the gate is several high-effort passes; a UI change rejected after the
> gate means running the whole gate twice. This generalizes step 4 of the lighter bug-fix
> flow above to every UI diff, initiatives included. Diffs with no user-visible UI surface
> skip step zero and go straight to the gate.

## Consequences

- Claude screenshots first, the user looks second, the gate runs third; a UI diff with no
  screenshot has not started the gate.
- Diffs without a user-visible surface skip step zero entirely.
- The viewport set and overflow reporting were tightened on 2026-08-12 (ADR 0009) after the
  step passed clean for five weeks on a real overflow.
- ADR 0015 later moved the human look for Tier B and above to staging; Claude's own screenshots
  stay as step zero in every tier.
