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

- A landing page's phone menu is wired after the feed-config guard in `js/happening.js`: if
  `happening-config.js` or `happening-render.js` fails to load, the hamburger does nothing on
  that page (the hubs are unaffected — they load `js/stories.js`). Pre-existing; found by the
  2026-09-30 gate. Fix: run the drawer block before the `if (!cfg || !R) return;` guard.

- The staff list (`/app/events`) prints a time range reversed in RTL ("18:30–17:00") — the
  en-dash bidi issue fixed on the public pages by `hours()` in `js/happening-render.js`
  (LRI/PDI). Seen 2026-09-30.

## Open feature ideas

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

- 2026-09-30 — The staff module is "יוזמות" / "مبادرات" (ADR 0060): launcher tile via
  `61_events_module_label.sql` (hand-applied on staging and prod 2026-09-30;
  `select label from core.modules where key = 'events'` → `יוזמות` on both), page heading and
  the Users & Permissions name via the module dictionaries (PR #98).

- 2026-09-30 — PR #97: landing pages, calendar hub, cost + booking, paged hub, small photo
  copies for cards and WhatsApp previews, "יוזמות נוספות" by nearest date (ADRs 0056–0059).
