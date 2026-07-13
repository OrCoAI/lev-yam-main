# Quotes — module log

Live at `/app/quotes`. Schema: `supabase/schema/30_quotes.sql`. UI:
`app-src/src/modules/quotes/`. Background:
[plans/quotes-module.md](../plans/quotes-module.md).

See [README.md](README.md) for how this file works — bugs/small features only; anything
touching schema, permissions, or the events/finance spine graduates to a `docs/plans/` plan.

**Note:** `~/lev-yam-quotes` (the original local app) is archived read-only — don't revive
it for fixes; everything now happens in this module.

## Open bugs

- (none logged)

## Open feature ideas

- (none logged)

## Done

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
