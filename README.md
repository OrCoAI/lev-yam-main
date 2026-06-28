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

Deployed via **GitHub Pages** with a committed `CNAME`. It contains a **static marketing site**
+ standalone tools (no build step), and a **built internal platform** under `/app`:

| Surface | Purpose | Build |
|---|---|---|
| [`index.html`](index.html) | Public marketing & booking site (HE/AR) | static |
| [`survey-june.html`](survey-june.html) | Community survey for the "חבורת לב ים" group | static |
| [`pos.html`](pos.html) | Internal point-of-sale / billing app for staff (live) | static |
| [`app-src/`](app-src/) → `/app` | Internal staff **platform** (login + permission-gated modules) | Vite + React + TS |

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
- **Schema:** [`supabase/schema/10_pos.sql`](supabase/schema/10_pos.sql) — run once in the Supabase SQL editor
  - Tables: `pos_tables` (live open tables), `pos_bills` (paid bills), `pos_bill_items` (line items)
  - RPCs: `pos_close_table`, `pos_reopen_bill` (atomic close / re-open)
  - Analytics views: `v_sales_daily`, `v_item_sales`, `v_category_sales`, `v_sales_hourly`
- Open-house and à-la-carte pricing modes, cash/card split, headcount & table-duration tracking

## 4. Internal platform — `/app`

A Vite + React + TypeScript app (source in [`app-src/`](app-src/)) behind a Supabase Auth login,
served at **levyam.com/app**. It's the home for new internal modules.

- **Auth:** email + password (Face ID / passkeys planned). Excluded from crawlers in `robots.txt`.
- **Permissions:** role → module → action (RBAC), enforced by Postgres RLS via
  `core.has_permission()` and mirrored in the UI for gating. Schema:
  [`supabase/schema/00_core.sql`](supabase/schema/00_core.sql).
- **Data layout:** one Supabase project, one schema per module (`core` for identity/permissions,
  `pos` for POS once migrated, etc.).
- **First module:** Users & Permissions admin (`src/modules/users/`). POS and the survey stay
  standalone until migrated in.

See [`supabase/README.md`](supabase/README.md) for first-time setup.

---

## Project structure

```
lev-yam/
├── index.html              ← Public marketing site (+ footer "Staff login" → /app)
├── survey-june.html        ← Community survey
├── pos.html                ← Staff POS / billing app (live, standalone)
├── css/ js/ fonts/ img/    ← Marketing assets (styles, logic+i18n, woff2, media)
├── app-src/                ← Internal platform: Vite + React + TS (builds to /app)
│   ├── src/
│   │   ├── lib/            ← supabase client, auth, permissions
│   │   ├── shell/          ← login, layout, launcher, route guards
│   │   └── modules/users/  ← first module: Users & Permissions admin
│   └── vite.config.ts      ← base '/app/'
├── supabase/
│   ├── schema/
│   │   ├── 00_core.sql     ← identity & permissions (roles, RLS, helpers)
│   │   └── 10_pos.sql      ← POS database schema
│   ├── functions/          ← Edge Functions (service-role only; e.g. passkeys)
│   └── README.md           ← setup & security model
├── .github/workflows/      ← deploy.yml (build /app + bundle marketing → Pages)
├── docs/                   ← Brand book, source docs (archive/ = historical records)
├── tests/                  ← Dynatrace bizevents test harnesses
├── CNAME                   ← levyam.com (GitHub Pages)
├── robots.txt              ← Allows all; disallows /pos.html and /app
└── sitemap.xml
```

## Tech stack

- **Marketing + survey + POS:** plain HTML5 + CSS3 + vanilla JS, no build tools. Fonts are
  self-hosted woff2 subsets. Supabase (via CDN) backs the survey and POS.
- **Platform (`/app`):** Vite + React 18 + TypeScript + react-router; Supabase Auth + RLS.

## Local development

```bash
# Marketing site / survey / POS — no build:
python3 -m http.server 8080        # → http://localhost:8080

# Platform:
cd app-src && npm install && npm run dev   # → http://localhost:5173/app
```

Copy `app-src/.env.example` → `app-src/.env.local` and fill in your Supabase URL + anon key.

## Deployment

Push to `main`. The GitHub Action (`.github/workflows/deploy.yml`) builds the platform and
bundles it with the static site, publishing to GitHub Pages at **levyam.com** (`CNAME`).

**One-time setup:** Settings → Pages → Source = *GitHub Actions*; add repo Secrets
`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`; apply `supabase/schema/*.sql` and expose the
`core` schema — see [`supabase/README.md`](supabase/README.md).
