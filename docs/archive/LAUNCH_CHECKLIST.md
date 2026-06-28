# Lev Yam — Launch Checklist

**Website:** levyam.com
**Status:** ✅ Launched and live

---

## ✅ LAUNCH COMPLETE

The site has been launched and is live at [levyam.com](https://levyam.com). All blocking items below were resolved before going live. This document is kept as a historical record of the pre-launch checklist.

What changed since this checklist was originally written:
- All real photos and the hero video shipped (final file types are `.jpg/.jpeg/.mp4`, not all `.webp` as originally planned).
- Fonts ship as Hebrew/Latin subset files (`Heebo-hebrew.woff2`, `Heebo-latin.woff2`, `Assistant-hebrew.woff2`, `Assistant-latin.woff2`) instead of separate weight files.
- Gallery was redesigned from a 12-image grid into an 18-image filmstrip carousel.
- The standalone "המרחב" section was removed in the redesign, so `space-overview.webp` is no longer needed.
- HE ↔ AR (Levantine Arabic) language toggle was added post-launch.
- Dynatrace RUM tag + 5 business event types added: `levyam.whatsapp_cta`, `levyam.service_interest`, `levyam.contact_intent`, `levyam.language_switch`, `levyam.faq_open`.

**Still open (non-blocking):**
- `og:image` is currently the 600×599 logo square. Optional upgrade to a proper 1200×630 banner for better social cards — deferred.

---

## ASSETS (historical)

- [x] Font files in `/fonts/` (shipped as Hebrew/Latin subsets, not weight files)
- [x] `img/hero/hero-poster.jpg` exists
- [x] `img/hero/hero.mp4` exists
- [x] All 5 service card photos in `img/services/` (offsite, community, private, rental, weekend)
- [ ] ~~`img/space/space-overview.webp`~~ — no longer needed, "המרחב" section removed in redesign
- [x] 18 gallery images in `img/gallery/` (`01.jpg` → `18.jpg`) — was 12, now 18 in carousel
- [ ] ~~`assets/og-image.jpg` (1200×630)~~ — deferred; current og:image is the 600×599 logo
- [x] All placeholder `<div class="img-placeholder">` replaced with real `<img>` tags

---

## CONTENT (historical)

- [x] No placeholder text visible anywhere on the page
- [x] Hero tagline: `המקום שבו הלב פוגש את הים`
- [x] All 5 service cards have titles, descriptions, and WhatsApp CTAs
- [x] All 7 FAQ questions and answers present
- [x] Footer shows: logo, tagline, phone, email, address with Google Maps link
- [x] Copyright: `© לב ים 2026`
- [x] Arabic (Levantine) translation + HE/AR toggle (post-launch addition)

---

## CONTACT (historical)

- [x] All WhatsApp links use `wa.me/972506669138`
- [x] Footer phone: `050-6669138` links to `tel:+972506669138`
- [x] Footer email: `info@levyam.com` links to `mailto:info@levyam.com`
- [x] Footer address links to Google Maps
- [x] Instagram links to `https://www.instagram.com/levyam_`
- [x] Facebook links to `https://m.facebook.com/profile.php?id=61585790351617`

---

## WHATSAPP — verified at launch

All 12 WhatsApp CTAs (header, hero, 5 service cards, 4 contact buttons, floating sticky) confirmed with correct pre-filled Hebrew messages.

---

## MAP & NAVIGATION

- [x] Google Maps iframe shows correct location (Jisr az-Zarqa fishing village)
- [x] Footer address Google Maps link opens correctly

---

## HOSTING

- [x] DNS pointing `levyam.com` to GitHub Pages (CNAME committed)
- [x] HTTPS active
- [x] No external CDN calls (fonts self-hosted)

---

## OBSERVABILITY (added post-launch)

- [x] Dynatrace RUM tag in `<head>`
- [x] 5 business event types tracked from `js/app.js`:
  - `levyam.whatsapp_cta` — every WhatsApp button click with `data-bizevent-source`
  - `levyam.service_interest` — service-card CTA clicks
  - `levyam.contact_intent` — contact-section button clicks
  - `levyam.language_switch` — HE ↔ AR toggle
  - `levyam.faq_open` — FAQ question opens
