# 0076 — One shared site chrome, the business page's own dictionary and Dynatrace events, a committed map key, and a retired subdomain redirects from a repo of its own

- **Date:** 2026-11-25
- **Status:** accepted — amends [0075](0075-site-redesign-business-first-two-looks-one-chrome-a-business-strip.md)
  (its open "redirect page or DNS" question is answered here) and the scope sentence of
  `CLAUDE.md`'s analytics rule ("homepage-only"); [0006](0006-ga4-carries-whatsapp-click-tier-separation-console-side.md)
  stands unchanged (no new GA4 event).
- **Decided by:** owner + Claude Code (close-out of [plans/site-redesign-business-first.md](../plans/site-redesign-business-first.md))
- **Source:** that plan's *Decisions made on the way* (2026-11-23 to 2026-11-25) and the
  gate's review of [PR #196](https://github.com/OrCoAI/lev-yam-main/pull/196)

## Context

The redesign brought the business page onto `levyam.com/business/`. The owner asked for the
header, phone menu, footer and floating WhatsApp button to be identical on every page and for
the logo to always lead home. The business page keeps its own look and its own script. It
needed a satellite map that a commercial site may use. The old `b2b.levyam.com` site turned
out to be serving private working files from a public repo, so it could not simply stay up
until the outcome check.

## Decision

1. **One chrome on every public page.** The header, phone menu, footer and floating WhatsApp
   button are the same on the homepage, `/business/`, story pages, hubs and initiative pages.
   Their behaviour lives in one script, `js/chrome.js`: the stuck header, the menu's backdrop,
   tap-outside, focus trap and scroll lock, and the floating button stepping aside. Their CSS
   lives in `css/styles.css` and in a scoped copy, `css/business-chrome.css`, for the business
   page. **A chrome change edits both files** until the follow-up merges them into one
   `css/chrome.css` (roadmap item 1a's follow-ups).
2. **`/business/` has its own dictionary and its own Dynatrace events.**
   - Its strings are `TRANSLATIONS` in `js/business.js`; the homepage's are in `js/app.js`.
     Both remember the visitor's language under the same `localStorage` key, so a choice
     carries across pages on the same domain.
   - Its events go to Dynatrace only, like the homepage's: `levyam.cta.click`,
     `levyam.pillar.toggle`, `levyam.planner.step`, `levyam.planner.select`,
     `levyam.language_switch`. Each carries `event.lang` and `event.page_slug = business`.
   - Its WhatsApp clicks go through `js/wa-track.js` like every other page's. Each one also
     sends a Dynatrace `levyam.whatsapp.click` carrying the planner's answers: the kind of
     event, the group size, the month and the parts chosen, never who the visitor is.
3. **The map uses Lev Yam's own ArcGIS Location Platform key, committed in `js/app.js`.**
   - It is a browser key: public by design, restricted to the referrers `levyam.com` and
     `staging.levyam.com`.
   - It expires on 2027-11-25, and the renewal is in the owner's calendar.
   - If its tiles fail, the map falls back to the street map.
   - Only browser keys of this kind may be committed; a secret key never is (invariant 2's
     spirit).
4. **A retired subdomain redirects from a repo of its own.**
   - `b2b.levyam.com` is served by `OrCoAI/levyam-b2b-redirect`, which holds only a redirect
     page, the same page as `404.html` (so every old path redirects), and `CNAME`.
   - The repo that held the old site, `lev-yam-b2b`, is private, intact and not archived.
   - It was redirected on launch day, not after the outcome check, because its history held
     private working files.
5. **Small text on the blue bands is large text.** Cream on the brand blue is 3.3:1, so any
   small line set on the blue bands is at least 19px and bold (`max(1.1875rem, 1em)`, 700),
   meeting the large-text contrast threshold. The bands keep the brand blue.

## Consequences

- One place to change the chrome's behaviour; two places, for now, to change its look. The
  copy in `css/business-chrome.css` is the known debt.
- Analytics for the marketing site now has two pages with Dynatrace-only events, and both say
  which page and language an event came from. The outcome metric for `/business/` stays GA4's
  `whatsapp_click` by `page_slug`.
- The map key is a dated dependency: if it is not renewed by 2027-11-25, the map drops to the
  street map. Nothing breaks.
- A rollback of the redirect removes the custom domain from `levyam-b2b-redirect`. It does not
  restore the old page.
