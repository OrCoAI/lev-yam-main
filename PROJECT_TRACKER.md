# Lev Yam — Project Tracker

**Last updated:** April 2026
**Website:** levyam.com
**Status:** Site built — assets & hosting needed before launch

---

## SECTION 1: WHAT'S DONE ✅

| Item | Status |
|---|---|
| Full site built (HTML/CSS/JS) | ✅ Done |
| All Hebrew copy updated | ✅ Done |
| RTL + accessibility | ✅ Done |
| 5 service cards | ✅ Done |
| FAQ (10 questions + answers) | ✅ Done |
| Gallery lightbox | ✅ Done |
| Mobile responsive | ✅ Done |
| WhatsApp CTAs (all buttons) | ✅ Done |
| JSON-LD structured data (FAQ + LocalBusiness) | ✅ Done |
| Meta / OG tags | ✅ Done |
| Icons (`img/icons/`) | ✅ Done |
| Favicon (`favicon.svg`) | ✅ Done |
| Map embed + Waze + Google Maps links | ✅ Done |
| Instagram + Facebook links | ✅ Done |
| robots.txt | ✅ Done |

---

## SECTION 2: WHAT'S MISSING ❌

### 2.1 — Logo — BLOCKER

Logo files were removed from the repo. The site currently shows a text placeholder ("לב ים") in the header and footer.

Ask **Elad** (your designer) to export these files:

| File to add | Folder | What it is |
|---|---|---|
| `logo-full.svg` | `img/logo/` | Full color logo (header) — 120×40px |
| `logo-mono.svg` | `img/logo/` | White/mono version (footer) — 100×40px |
| `logo-mark.svg` | `img/logo/` | Icon only (for favicon + social) |

Once you have the files, replace the `<!-- TODO -->` comments in `index.html` (lines ~113 and ~633) with a standard `<img>` tag.

---

### 2.2 — Fonts — EASY FIX (~30 min)

| File to add | Folder | Weight |
|---|---|---|
| `Heebo-Regular.woff2` | `fonts/` | 400 |
| `Heebo-Medium.woff2` | `fonts/` | 500 |
| `Heebo-Bold.woff2` | `fonts/` | 700 |
| `Assistant-Regular.woff2` | `fonts/` | 400 |
| `Assistant-SemiBold.woff2` | `fonts/` | 600 |

**Steps:**
1. Go to [fonts.google.com/specimen/Heebo](https://fonts.google.com/specimen/Heebo) → Download family
2. Go to [fonts.google.com/specimen/Assistant](https://fonts.google.com/specimen/Assistant) → Download family
3. Convert `.ttf` → `.woff2` at [cloudconvert.com/ttf-to-woff2](https://cloudconvert.com/ttf-to-woff2)
4. Add the 5 files to the `/fonts/` folder

---

### 2.3 — Photography — BIGGEST GAP

#### Hero (add to `img/hero/`)
| Filename | Size | Max | What to capture |
|---|---|---|---|
| `hero-poster.webp` | 1920×1080 | 180 KB | Close-up waves + fishing boats |
| `hero.mp4` | 1920×1080 | 6 MB | 10–15 sec loop, same subject, muted |

#### Service Cards (add to `img/services/`)
| Filename | Size | Max | What to capture |
|---|---|---|---|
| `offsite.webp` | 800×600 | 80 KB | Team around a table, daytime |
| `community.webp` | 800×600 | 80 KB | Casual group, people, sunset |
| `private.webp` | 800×600 | 80 KB | Celebration — table, food, people |
| `rental.webp` | 800×600 | 80 KB | Wide shot of venue at golden hour |
| `weekend.webp` | 800×600 | 80 KB | Friday/Saturday atmosphere, food |

#### Space Overview (add to `img/space/`)
| Filename | Size | Max | What to capture |
|---|---|---|---|
| `space-overview.webp` | 900×700 | 90 KB | Pergola + sea, wide angle |

#### Open Graph Image (add to `assets/`)
| Filename | Size | Max | What to include |
|---|---|---|---|
| `og-image.jpg` | 1200×630 | 200 KB | Logo + tagline + hero photo |

#### Gallery (add to `img/gallery/`)
12 images minimum. Each needs: `XX-large.webp` (1600×1200, ≤180 KB).

| Group | Qty | Subject |
|---|---|---|
| 01–03 | 3 | Arriving — the village, the path, the entrance |
| 04–06 | 3 | The space — interior, pergola, details |
| 07–09 | 3 | People — working, eating, talking |
| 10–12 | 3 | Sea & golden hour — sunset, boats, water |

**Photography rules:**
- Every service card photo MUST show at least one person
- Natural light always preferred
- Close and immersive beats aerial/drone

---

### 2.4 — Hosting & Domain

- [ ] Point `levyam.com` DNS to hosting provider
- [ ] SSL certificate active (HTTPS)
- [ ] Test live site on mobile and desktop

---

## QUICK ACTION LIST

**This week:**
- [ ] Ask Elad for logo SVG files (logo-full, logo-mono, logo-mark)
- [ ] Download + convert Heebo and Assistant fonts to woff2

**Before photo shoot:**
- [ ] Review shot list in §2.3 above

**Before launch:**
- [ ] Add all photos and logo
- [ ] Run `LAUNCH_CHECKLIST.md` top to bottom
- [ ] Deploy to hosting + connect domain
