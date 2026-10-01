# Events — module log

Live at `/app/events` (staff) and `/happening/` (public, "יוזמות" / "مبادرات"). Schema:
`supabase/schema/40_events.sql`, `58_events_public.sql`, `59_events_landing.sql`,
`60_events_cost.sql`, `61_events_module_label.sql`. UI: `app-src/src/modules/events/`;
public surface: `happening/`, `js/happening*.js`, `css/happening.css`,
`scripts/gen-happening.mjs`. Background:
[plans/events-whats-happening.md](../plans/events-whats-happening.md) (ADRs 0054–0060).

See [README.md](README.md) for how this file works — bugs/small features only; anything
touching schema, permissions, or the events/finance spine graduates to a `docs/plans/` plan.

## Open bugs

_(none)_

## Open feature ideas

- One shared drawer script (e.g. `js/nav-drawer.js`) for story pages, the hubs and landing
  pages: `js/happening.js` carries a copy of `js/stories.js`'s drawer (minus the WhatsApp
  matcher), gated on `data-happening-slug`. Needs the assemble allowlist (Tier A) and the
  templates' script tags. Raised by the 2026-10-01 simplify pass.
- A header that comes back on scrolling up (phones) — built for the initiative pages on
  2026-09-30 and reverted on the owner's call for consistency with story pages (ADR 0059 §6).
  If wanted, one change for story pages and initiative pages together.
- Arabic native reader's pass on the public wording: the CTA line, "مبادرات", the about
  paragraph, the new labels ("شوفوا مبادرات كمان", the calendar's day count). Shipped without
  it on the owner's call (2026-09-30).
- Test data: staging holds 15 planted initiatives (ids `5eed0000-0000-4000-8000-0000000002NN`,
  `notes = 'planted test item 2026-09-30'`, photos under those id prefixes) kept on the owner's
  call; remove when no longer useful. Never on prod.

## Done

- 2026-10-01 — A landing page's phone menu is wired before the feed-config guard in
  `js/happening.js` (works when the config or renderer fails to load; hubs keep
  `js/stories.js`'s drawer); the staff list holds a time range left-to-right (LRI/PDI), like
  `hours()` in the renderer. Both found 2026-09-30.

- 2026-09-30 — The staff module is "יוזמות" / "مبادرات" (ADR 0060): launcher tile via
  `61_events_module_label.sql` (hand-applied on staging and prod 2026-09-30;
  `select label from core.modules where key = 'events'` → `יוזמות` on both), page heading and
  the Users & Permissions name via the module dictionaries (PR #98).

- 2026-09-30 — PR #97: landing pages, calendar hub, cost + booking, paged hub, small photo
  copies for cards and WhatsApp previews, "יוזמות נוספות" by nearest date (ADRs 0056–0059).
