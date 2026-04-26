# לב ים — Lev Yam Website

מרחב יזמות עסקית חברתית על קו המים — כפר הדייגים, ג׳יסר א-זרקא.

**Website:** levyam.com
**WhatsApp:** +972506669138
**Email:** info@levyam.com
**Instagram:** [@levyam_](https://www.instagram.com/levyam_)
**Facebook:** [לב ים](https://m.facebook.com/profile.php?id=61585790351617)

---

## Status

**Code: ✅ Complete** — Design, copy, SEO, RTL, accessibility, all sections built.
**Pending launch:** Photos, fonts, and hosting (see below).

---

## Project Structure

```
lev-yam/
├── index.html              ← Single-page site
├── css/styles.css          ← All styles (RTL, responsive, animations)
├── js/app.js               ← Interactions (nav, gallery lightbox, FAQ, scroll)
├── fonts/                  ← Self-hosted woff2 files (MISSING — see below)
├── img/
│   ├── hero/               ← levyam1-nobg.png + hero photo/video (MISSING)
│   ├── logo/               ← logo-full.png · logo-mark.png · logo-mono-nobg.png
│   ├── icons/              ← icons-19-nobg.png
│   ├── services/           ← 5 service card photos (MISSING)
│   ├── space/              ← Space overview photo (MISSING)
│   └── gallery/            ← 12 gallery images (MISSING)
├── assets/                 ← og-image.jpg for social sharing (MISSING)
├── docs/                   ← Source documents and brand spec
├── .gitignore
└── robots.txt
```

## Tech Stack

Plain HTML5 + CSS3 + Vanilla JS. No build tools, no frameworks, no npm.
Deployable to any static host: Netlify, Cloudflare Pages, GitHub Pages, S3.

## Local Development

No build step. Serve locally:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

---

## Before Launch — What's Missing

### 1. Fonts (30 min)
Download from Google Fonts and place `.woff2` files in `/fonts/`:

| File | Font | Weight |
|---|---|---|
| `Heebo-Regular.woff2` | Heebo | 400 |
| `Heebo-Medium.woff2` | Heebo | 500 |
| `Heebo-Bold.woff2` | Heebo | 700 |
| `Assistant-Regular.woff2` | Assistant | 400 |
| `Assistant-SemiBold.woff2` | Assistant | 600 |

Download at [fonts.google.com](https://fonts.google.com), convert TTF → WOFF2 at [cloudconvert.com](https://cloudconvert.com/ttf-to-woff2).

### 2. Photography

#### Hero (`img/hero/`)
| File | Size | Notes |
|---|---|---|
| `hero-poster.webp` | 1920×1080, ≤180 KB | Waves + fishing boats, close-up |
| `hero.mp4` | 1920×1080, ≤6 MB | 10–15 sec muted loop, same subject |

#### Services (`img/services/`) — every photo must show at least one person
| File | Size | Subject |
|---|---|---|
| `offsite.webp` | 800×600, ≤80 KB | Team around a table, daytime |
| `community.webp` | 800×600, ≤80 KB | Casual group, sunset |
| `private.webp` | 800×600, ≤80 KB | Celebration — table, food, people |
| `rental.webp` | 800×600, ≤80 KB | Wide shot of venue, golden hour |
| `weekend.webp` | 800×600, ≤80 KB | Friday/Saturday atmosphere, food |

#### Space (`img/space/`)
| File | Size | Subject |
|---|---|---|
| `space-overview.webp` | 900×700, ≤90 KB | Pergola + sea, wide angle |

#### Gallery (`img/gallery/`) — 12 images minimum
Each file: `XX-large.webp` (1600×1200, ≤180 KB)

| Files | Subject |
|---|---|
| `01–03` | Arriving — the village, the path, the entrance |
| `04–06` | The space — interior, pergola, details |
| `07–09` | People — working, eating, talking |
| `10–12` | Sea & golden hour — sunset, boats, water |

#### Social Sharing (`assets/`)
| File | Size | Notes |
|---|---|---|
| `og-image.jpg` | 1200×630, ≤200 KB | Logo + tagline + hero photo |

### 3. Hosting & Domain
- Point `levyam.com` DNS to hosting provider
- Confirm SSL certificate is active (HTTPS)
- Test live site on mobile and desktop

---

## Launch Checklist

Run `LAUNCH_CHECKLIST.md` top to bottom before going live.

---

*Built April 2026*
