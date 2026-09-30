# 0060 — The staff module is named "יוזמות" / "مبادرات" too

- **Date:** 2026-09-30
- **Status:** accepted. Amends [0058](0058-initiatives-stand-alone-cost-booking-fields-section-named-yozmot.md) §3, which kept the app's own name ("מה קורה") while renaming the public section.
- **Decided by:** owner, after the merge of PR #97; confirmed on localhost.
- **Source:** the owner's request in the session of 2026-09-30: "change the staff app's module title … to יוזמות".

## Context

ADR 0058 §3 renamed only what visitors see ("יוזמות" / "مبادرات" on the public site); the staff
app kept "מה קורה" on its launcher tile and page heading, and "אירועים" in Users & Permissions.

## Decision

The events module is called "יוזמות" (Arabic "مبادرات") everywhere staff see it, as on the
public site:

- the launcher tile — `core.modules.label`, set by `61_events_module_label.sql` (one label shown
  in both languages until module labels are bilingual; the update runs only from 58's label, so a
  later rename by the owner is never undone);
- the module's page heading — `app-src/src/modules/events/i18n.ts`;
- the module's name in Users & Permissions — `app-src/src/modules/users/i18n.ts` (it said
  "אירועים" / "الفعاليات" since the module was created; the same permissions also cover the
  internal calendar, and the owner's name for the module wins).

The module key stays `events`, the route `/app/events`, the permission keys `events.*`.

## Consequences

`61_events_module_label.sql` changes data in an existing row, so it reaches staging and prod only
when hand-applied (management API), and the grant audit cannot notice if it never is — the check
is `select label from core.modules where key = 'events'` → `יוזמות` on each tier.
