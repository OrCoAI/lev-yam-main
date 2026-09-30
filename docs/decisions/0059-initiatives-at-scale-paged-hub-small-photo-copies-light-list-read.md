# 0059 — Initiatives at scale: a paged hub, a small copy beside every photo, a light list read; the header stays the story pages' header

- **Date:** 2026-09-30
- **Status:** accepted. Extends [0056](0056-whats-happening-item-pages-are-generated-landing-pages-rebuilt-on-publish.md) and [0058](0058-initiatives-stand-alone-cost-booking-fields-section-named-yozmot.md); neither changes.
- **Decided by:** owner, on the last staging round of PR #97 ("what happens with 100 open initiatives?" — then "fix based on your suggestions", plus six page notes).
- **Source:** the owner's notes, verbatim in the plan's "Decisions made on the way" (2026-09-30).

## Context

At 100 live initiatives nothing broke, but the hub was one grid of 100 cards (about 49 phone
screens), every card loaded the full 1600px photo while showing it ~300px wide, the page's
"more initiatives" row and the card order were dominated by weekly items (always days away),
a busy calendar day hid how busy it was, and every page downloaded every item's full text.
Separately, a shared landing page showed no picture in WhatsApp: the preview image was the full
photo (~0.8 MB) and WhatsApp drops preview images over roughly 300 KB.

## Decision

1. **The hub pages its cards:** the refreshed list shows 12 and a button reveals 12 more (focus
   moves to the first revealed card). The page as built still lists every item — without
   JavaScript, and for crawlers, it is the whole list.
2. **Every uploaded photo gets a small copy beside it**, `<name>-sm.jpg`, ~800px long edge,
   written by the `/app/events` upload next to the full one and deleted with it. Cards, the
   calendar's day panel and the link-preview image (`og:image`) use it. The rule lives twice,
   in `js/happening-render.js` (`thumbPath`) and `app-src/src/modules/events/api.ts`
   (`thumbPath`), and the two must agree. The copy is never listed in `image_paths`, so no
   schema or CHECK changes. Photos uploaded before this have no copy: a card's `<img>` carries
   `data-full` and `js/happening.js` swaps to it on a load error, and the generator checks the
   copy with one HEAD per item before naming it as the preview (a failed check is "no copy",
   never a failed build).
3. **Lists read the list columns only** (`R.LIST_QUERY`: no bodies, no optional lines). A
   landing page reads its own row whole, by slug, beside the list. The build still reads
   whole rows (`R.FEED_QUERY`).
4. **"More initiatives" is the three one-off items nearest in date** to the page's own item,
   filled with weekly ones only when there are fewer than three — a pure function of the feed,
   so the built page and the refreshed page agree.
5. **A calendar day with more than three items** shows two dots and "+N"; its label names
   every item.
6. **The header is the story pages' header, behaviour included.** The owner first asked for the
   phone menu to come back on scrolling up; it was built for the initiative pages (sticky,
   tucked while scrolling down), and on seeing that story pages would differ the owner chose
   consistency: the initiative pages keep the same static header as every story page
   (2026-09-30). If the menu should ever return on scrolling up, it is one change for both
   surfaces, not one of them. (Built that way, it must move by the sticky `top`, never a
   transform — a transform re-anchors the fixed drawer inside the header.)
7. **The landing page loses the zigzag under the header and the "יוזמות בלב ים" pill**; a
   recurring item's end date is no longer shown to visitors (the calendar and the next date
   already stop there); a time range is held left-to-right (an en dash in an RTL line showed
   "11:00–09:00"). The Waze button opens the owner's link `waze.com/ul/hsvbc45p5d`
   (FACTS.md; ~26 m from the recorded coordinates).

## Consequences

- A photo is two storage objects. The bucket's policies have no name rule, so nothing else
  changes; `removeImages` removes both, and a missing copy is ignored.
- Prod's photos uploaded before this merge have no copies: they show through the fallback and
  keep the full photo as their preview until re-uploaded or backfilled.
- The hub's paging is browser-side, so the built HTML stays the full list (larger at 100
  items, still small: text only, images lazy).
