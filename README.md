# לב ים — Lev Yam

מרחב יזמות עסקית חברתית על קו המים — כפר הדייגים, ג׳יסר א-זרקא.

A social-business entrepreneurship space on the waterfront in the Jisr az-Zarqa fishing
village, on the Israeli coast between Tel Aviv and Haifa. The venue hosts corporate
offsites, private celebrations, community days, weekend events, and full venue rental.

**Website:** [levyam.com](https://levyam.com) · **Status: 🟢 Live**
**WhatsApp:** [+972506669138](https://wa.me/972506669138) · **Email:** info@levyam.com
**Instagram:** [@levyam_](https://www.instagram.com/levyam_) · **Facebook:** [לב ים](https://m.facebook.com/profile.php?id=61585790351617)

---

## What's in the repo

This is a static site (no build step, no frameworks) deployed via **GitHub Pages** with a
committed `CNAME`. It contains three independent front-ends that share the same fonts and
hosting:

| Page | Purpose |
|---|---|
| [`index.html`](index.html) | The public marketing & booking site (HE/AR) |
| [`survey-june.html`](survey-june.html) | Community survey for the "חבורת לב ים" group |
| [`pos.html`](pos.html) | Internal point-of-sale / billing app for venue staff |

---

## 1. Marketing site — `index.html`

Single-page bilingual (Hebrew + Levantine Arabic, RTL) site.

- **Sections:** hero → intro → services (5 cards) → why → gallery → FAQ (7 Q) → contact
- **Hero:** background video (`img/hero/hero.mp4`) with poster fallback
- **Gallery:** filmstrip carousel, 18 images (`img/gallery/01–18`)
- **i18n:** HE ↔ AR language toggle, full dictionary in [`js/app.js`](js/app.js)
- **Analytics:** Dynatrace RUM + 5 business-event types
  (`whatsapp_cta`, `service_interest`, `contact_intent`, `language_switch`, `faq_open`)
- **Marketing:** Meta Pixel `3961552923978842` — base `PageView` plus a standard
  `Contact` event fired from every WhatsApp CTA click

Styles: [`css/styles.css`](css/styles.css) · Logic: [`js/app.js`](js/app.js)

> **Note:** `og:image` is currently the 600×599 logo square. A 1200×630 banner would give
> better social cards — optional, not blocking.

## 2. Community survey — `survey-june.html`

Standalone bilingual survey for venue community members, with conditional follow-ups,
validation, and a progress bar.

- Submits to **Supabase** (`survey_responses` table)
- Optional voice notes upload to the Supabase `voice-notes` storage bucket
- Styles: [`css/survey.css`](css/survey.css) · Logic: [`js/survey.js`](js/survey.js)

## 3. Point-of-sale app — `pos.html`

Internal billing/POS tool for staff, with live multi-device sync. Excluded from search
engines via `robots.txt`.

- **Backend:** Supabase (`@supabase/supabase-js` via CDN) with realtime sync
- **Schema:** [`supabase_schema.sql`](supabase_schema.sql) — run once in the Supabase SQL editor
  - Tables: `pos_tables` (live open tables), `pos_bills` (paid bills), `pos_bill_items` (line items)
  - RPCs: `pos_close_table`, `pos_reopen_bill` (atomic close / re-open)
  - Analytics views: `v_sales_daily`, `v_item_sales`, `v_category_sales`, `v_sales_hourly`
- Open-house and à-la-carte pricing modes, cash/card split, headcount & table-duration tracking

---

## Project structure

```
lev-yam/
├── index.html              ← Public marketing site
├── survey-june.html        ← Community survey
├── pos.html                ← Staff POS / billing app
├── supabase_schema.sql     ← POS database schema (run in Supabase)
├── css/
│   ├── styles.css          ← Marketing site styles
│   └── survey.css          ← Survey styles
├── js/
│   ├── app.js              ← Marketing site logic + i18n
│   └── survey.js           ← Survey logic + Supabase submission
├── fonts/                  ← Self-hosted woff2 (Heebo + Assistant, HE/Latin subsets)
├── img/
│   ├── hero/               ← hero.mp4, hero-poster.jpg, h1–h3 stills
│   ├── logo/               ← logo-full · logo-mark · logo-mono-nobg
│   ├── icons/              ← heart · house-blue · palm-orange · sun-orange
│   ├── services/           ← 5 service-card photos
│   └── gallery/            ← 18 gallery images
├── docs/                   ← Brand book, source docs, website report
├── tests/                  ← Dynatrace bizevents test harnesses
├── CNAME                   ← levyam.com (GitHub Pages)
├── robots.txt              ← Allows all; disallows /pos.html
└── .gitignore
```

## Tech stack

Plain HTML5 + CSS3 + vanilla JS. No build tools, no npm, no frameworks. Supabase (via CDN)
backs the survey and POS. Fonts are self-hosted woff2 subsets.

## Local development

No build step. Serve the folder over HTTP:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## Deployment

Pushing to `main` deploys to GitHub Pages, served at **levyam.com** (`CNAME`).
For the POS, apply [`supabase_schema.sql`](supabase_schema.sql) in the Supabase SQL editor
before first use.
