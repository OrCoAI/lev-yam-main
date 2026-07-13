# POS — module log

Platform module live at `/app/pos` (parity trial alongside standalone `pos.html`, which
stays the production POS until cut-over). Schema: `supabase/schema/10_pos.sql`,
`42_pos_platform.sql`. UI: `app-src/src/modules/pos/`.
Background: [plans/pos-module.md](../plans/pos-module.md).

See [README.md](README.md) for how this file works — bugs/small features only; anything
touching schema, permissions, or the events/finance spine graduates to a `docs/plans/` plan.

**Note:** `pos.html` is the live production surface for real service days — don't touch it
casually. Bugs/features specific to the standalone `pos.html` (pre-cut-over) also belong
here for now, tagged `[pos.html]`, since it's the same eventual module.

## Open bugs

- (none logged)

## Open feature ideas

- Parity trial: run `/app/pos` alongside `pos.html` on real service days (ROADMAP Phase 1)
- Cut-over follow-ups once parity holds: drop anon policies, harden `created_by` from JWT,
  consider `pos` schema move + menu-as-data + server-side bill recompute +
  `pos.range_report` (see [plans/pos-module.md](../plans/pos-module.md) §8a)

## Done

- (move closed items here with date + one-line note)
