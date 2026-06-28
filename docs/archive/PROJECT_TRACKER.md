# Lev Yam — Project Tracker

**Last updated:** May 2026
**Website:** [levyam.com](https://levyam.com)
**Status:** ✅ Launched and live

---

## ✅ Launch complete

The site is live at levyam.com (GitHub Pages, custom domain via committed `CNAME`). All originally blocking items — code, copy, photos, video, fonts, hosting — were resolved before going live. This document is kept as a historical record of the pre-launch plan. For the current state, see the "Live site — current state" section at the bottom.

---

## ✅ Done (pre-launch)

| Item | Notes |
|---|---|
| Full site built (HTML/CSS/JS) | Single page, no frameworks |
| Hebrew copy | All sections written |
| RTL + accessibility | `lang="he" dir="rtl"`, skip link, ARIA, keyboard nav |
| Hero section | Wordmark, styled headline, scroll cue, WhatsApp CTA |
| 5 service cards | Centered layout, photos shipped |
| למה לב ים section | Village story + features |
| Gallery + lightbox | Originally 12-image grid, now 18-image carousel (post-launch redesign) |
| FAQ (7 questions) | Accordion, keyboard accessible |
| Contact section | Map embed + 4 WhatsApp action cards with brand icons |
| Footer | Minimal single-line bar — logo, tagline, contact, copyright |
| Header | Logo, nav, social icons (Instagram + Facebook), WhatsApp CTA, language toggle |
| Logo | logo-full (header), logo-mono-nobg (footer), logo-mark (favicon) |
| Favicon | logo-mark.png + apple-touch-icon |
| Page title | לב ים | מרחב יזמות עסקית חברתית על קו המים |
| WhatsApp CTAs | All 12 buttons with correct pre-filled Hebrew messages |
| Map embed | Google Maps iframe + deep link |
| Social links | Instagram + Facebook in header and footer |
| JSON-LD schema | FAQPage + LocalBusiness structured data |
| Meta / OG tags | Title, description aligned across `<meta name="description">` and `og:description`, og:image, og:locale |
| robots.txt | Allows crawling |
| Mobile responsive | All breakpoints |
| Animations | Reveal on scroll, reduced-motion respected |
| Floating WhatsApp | Sticky button always visible |
| Photos | All service cards, gallery, and hero shipped |
| Hero video | `img/hero/hero.mp4` shipped as background |
| Fonts | Self-hosted Heebo + Assistant in `/fonts/` (Hebrew/Latin subsets) |
| Hosting | levyam.com served from GitHub Pages via CNAME |
| HTTPS | Active |
| .gitignore | .DS_Store and .claude/ excluded |
| Repo clean | Only active assets committed |

---

## ✅ Added post-launch

| Item | Notes |
|---|---|
| Arabic (Levantine) translation | Full HE ↔ AR toggle with i18n dictionary in `js/app.js` |
| Dynatrace RUM | Real-user monitoring tag in `<head>` |
| Business event tracking | 5 event types from `js/app.js` — see LAUNCH_CHECKLIST.md "OBSERVABILITY" section |
| Gallery redesign | 12-image grid → 18-image filmstrip carousel |
| Hero/CTA/footer polish | Multiple iterations |
| "המרחב" section removed | Content merged into other sections during redesign |

---

## Open / optional (non-blocking)

- `og:image` is currently the 600×599 logo square. A proper 1200×630 banner with logo + wordmark + brand background would give better social-share cards (WhatsApp/Facebook/X). Deferred — only worth doing if social sharing becomes a priority.

---

## Live site — current state

**Page structure:** hero → intro → services (5 cards) → why → gallery (18-image carousel) → faq (7 Q) → contact.

**Notable deltas from the original pre-launch plan above:**
- Gallery is no longer a CSS grid with column spans; it's a horizontal filmstrip carousel with snap scrolling.
- The standalone "המרחב / space" section was removed during the redesign, so `img/space/space-overview.webp` is no longer needed.
- Service-card photos shipped as `.jpg/.jpeg` rather than `.webp`.
- Fonts ship as Hebrew/Latin subset files (`Heebo-hebrew.woff2`, `Heebo-latin.woff2`, `Assistant-hebrew.woff2`, `Assistant-latin.woff2`) rather than per-weight files.
- Site is bilingual (HE default, AR toggle), not just Hebrew.
