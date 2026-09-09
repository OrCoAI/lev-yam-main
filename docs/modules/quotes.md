# Quotes — module log

Live at `/app/quotes`. Schema: `supabase/schema/30_quotes.sql`. UI:
`app-src/src/modules/quotes/`. Background:
[plans/quotes-module.md](../plans/quotes-module.md).

See [README.md](README.md) for how this file works — bugs/small features only; anything
touching schema, permissions, or the events/finance spine graduates to a `docs/plans/` plan.

**Note:** `~/lev-yam-quotes` (the original local app) is archived read-only — don't revive
it for fixes; everything now happens in this module.

## Open bugs

- Quote page at phone widths: the A4 document (798px) makes the whole page scroll sideways and the control pane sits far below it (seen on `main` 2026-09-09 via `screenshot.mjs`, pre-existing — the editor is desktop-first). Decide: scale the document to fit, or accept and document.

- Lint warnings (oxlint, ratcheted at 24 total on 2026-09-09): incomplete effect deps in QuotePage.tsx/ContractPage.tsx, a ref read during render — see `npm run lint`

## Open feature ideas

- (none logged)

## Done

- 2026-09-09 — `Toggle` in QuotePage.tsx was declared inside render (a new component identity per keystroke remounted the three toggles and dropped keyboard focus); hoisted to module scope. Found by the Step 3 lint pass.

- **2026-07-13 — follow-up: fixed the actual root cause of "confirmed" never matching
  real quotes, and reworked item reorder as real drag-and-drop** (same branch/PR cycle
  as the batch below, shipped as a second commit after user-reported regressions):
  - Root cause of both the calendar "confirmed only" filter and "waiting for payment"
    still not matching real quotes: `isConfirmed()` checked `event_confirmed`, a flag
    that's only ever set by the in-app contract-sign trigger — verified against
    production that 0 of 2 real `approved` quotes had it set, since staff approve
    quotes without generating/signing a contract in the app. Fixed `isConfirmed()` to
    check `status` (`approved`/`paid`) directly, with declined/expired always losing
    confirmed status regardless of a stale flag. This also fixes the "הכנות" prep-
    checklist chip, which had never shown on any real quote for the same reason.
  - Reworked line-item reorder from tiny up/down buttons to real pointer-based
    drag-and-drop (touch + mouse, no library) — row height unaffected by design (the
    handle fills the row's own height rather than adding to it); verified with real
    touch events (not just mouse) via CDP. Gate review caught and fixed an off-by-one
    in the insertion-index math on downward drags before ship.
- **2026-07-13 — batch of 9 bug fixes/small features** (branch
  `fix/quotes-batch-2026-07-13`), full gate run (simplify, code-review high, security-review,
  browser-verified in the preview harness):
  - Fixed calendar "confirmed only" filter showing nothing — it was always fed `liveQuotes`
    (excludes `status='paid'`), so a confirmed event vanished from the calendar the moment it
    was marked paid; now fed `activeQuotes` (excludes only archived)
  - PDF export now uses the quote number as the filename (sets `document.title` while the
    doc page is open)
  - Added a derived "waiting for payment" status (confirmed + event date passed + not paid,
    excluding declined/expired) — row tint, badge, and filter chip; see the note in
    [finance.md](finance.md) about superseding it with `finance.expected` later
  - New quotes auto-open the document page after the basic-info step instead of staying on
    the dashboard
  - Added up/down reorder for quote line items (mirrors the prep-checklist convention);
    extracted a shared `swapAdjacent()` helper used by both
  - Quotes table gained sortable date/price columns and a search box (customer/contact/
    phone/email/quote number)
  - New-quote creation warns (proceed/cancel) if another *active* quote already has that
    event date, regardless of status
  - Quotes table columns center-aligned except לקוח (customer) and הערות (notes), desktop
    only
