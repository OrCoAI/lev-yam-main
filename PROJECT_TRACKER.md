# Lev Yam — Project Tracker

**Last updated:** April 2026  
**Website:** levyam.com  
**Status:** Pre-development — assets needed before Claude Code build

---

## SECTION 1: WHAT'S READY ✅

| Asset | Status | Location |
|---|---|---|
| Full Hebrew copy (all sections) | ✅ Done | `docs/lev_yam_claude_code_instructions.md` §6 |
| Site map & page structure | ✅ Done | `docs/` |
| Brand book | ✅ Done | `docs/ספר_מותג__לב_ים.pdf` |
| Full technical build spec | ✅ Done | `docs/lev_yam_claude_code_instructions.md` |
| FAQ (10 questions + answers) | ✅ Done | Build spec §6.7 |
| WhatsApp messages (4 audiences) | ✅ Done | Build spec §4.10 |
| Feedback report | ✅ Done | `docs/lev_yam_website_report.pdf` |
| WhatsApp number | ✅ Done | `+972506669138` — updated in spec |
| Phone | ✅ Done | `050-6669138` — updated in spec |
| Email | ✅ Done | `info@levyam.com` — updated in spec |
| Domain | ✅ Done | `levyam.com` — updated in spec |
| GPS coordinates | ✅ Done | `32.5435, 34.9078` — in spec |
| Waze link | ✅ Done | `https://waze.com/ul/hsvbc45ng5` — in spec |
| Google Maps link | ✅ Done | `https://maps.app.goo.gl/fFtCZYwK1KEcmFud6` — in spec |
| Instagram handle | ✅ Done | `levyam_` — in spec |
| Facebook URL | ✅ Done | `https://m.facebook.com/profile.php?id=61585790351617` — in spec |
| Folder structure | ✅ Done | Ready in this repo |
| Color tokens | ✅ Done | Blue `#2c92bf` / Cream `#fff7ea` / Orange `#f49834` |

---

## SECTION 2: WHAT'S MISSING ❌

### 2.1 — Logo Files (SVG) — BLOCKER

Ask **Elad** (your designer) to export these 3 files from the source design file.

| File to add | Folder | What it is |
|---|---|---|
| `logo-full.svg` | `img/logo/` | Full color logo with palm tree (used in header) |
| `logo-mark.svg` | `img/logo/` | Palm icon only, square (used for favicon + social) |
| `logo-mono.svg` | `img/logo/` | Single-color version for dark backgrounds (footer) |

**How to ask Elad:** "Please export the logo as 3 SVG files: full color, mark only, and mono (white or cream single-color). Name them logo-full.svg, logo-mark.svg, logo-mono.svg."

---

### 2.2 — Fonts — EASY FIX (30 min)

Download from Google Fonts and convert to `.woff2`.

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

Every service card needs a photo **with people in it**. No empty rooms.  
Shoot or source all of these before giving Claude Code the green light to finalize.

#### Hero (add to `img/hero/`)
| Filename | Size | Max | What to capture |
|---|---|---|---|
| `hero-poster.webp` | 1920×1080 | 180 KB | Close-up waves + fishing boats (NOT drone/aerial) |
| `hero-poster.jpg` | 1920×1080 | 220 KB | Same image, JPEG fallback |
| `hero.mp4` | 1920×1080 | 6 MB | 10–15 sec loop, same subject, muted |

#### Service Cards (add to `img/services/`)
| Filename | Size | Max | What to capture |
|---|---|---|---|
| `offsite.webp` + `.jpg` | 800×600 | 80 KB | Team gathered around a table, daytime |
| `community.webp` + `.jpg` | 800×600 | 80 KB | Casual group, people, sunset |
| `private.webp` + `.jpg` | 800×600 | 80 KB | Celebration setup — table, food, people |
| `rental.webp` + `.jpg` | 800×600 | 80 KB | Wide shot of venue at golden hour |

#### Space Overview (add to `img/space/`)
| Filename | Size | Max | What to capture |
|---|---|---|---|
| `space-overview.webp` + `.jpg` | 900×700 | 90 KB | Pergola + sea, wide angle |

#### Open Graph Image (add to `assets/`)
| Filename | Size | Max | What to include |
|---|---|---|---|
| `og-image.jpg` | 1200×630 | 200 KB | Logo + tagline + hero photo (for WhatsApp link previews) |

#### Gallery — 20–30 images (add to `img/gallery/`)
Each image needs TWO files: `XX-thumb.webp` (600×400, ≤50 KB) and `XX-large.webp` (1600×1200, ≤180 KB).

**Shoot in this narrative order:**

| Group | Qty | Subject |
|---|---|---|
| 01–04 | 4 | Arriving — the village, the path, the entrance |
| 05–10 | 6 | The space — interior, pergola, textures, details |
| 11–18 | 8 | People — working, eating, talking, laughing |
| 19–23 | 5 | Food — Nimer cooking, dishes, fire, details |
| 24–28 | 5 | Sea & golden hour — sunset, boats, water |

**Photography rules:**
- Every service card photo MUST show at least one person
- No awkward head crops — show full heads or no heads
- Close and immersive beats aerial/drone
- Natural light always preferred

---

### 2.4 — Icons — Claude Code will recreate (no action needed)

Claude Code can generate these as inline SVGs from the brand book. But if Elad has them ready, drop them in `img/icons/`:

`palm.svg`, `sun.svg`, `house.svg`, `wave.svg`, `arch.svg`, `heart.svg`, `whatsapp.svg`, `chevron.svg`

---

## SECTION 3: HOW TO WORK WITH CLAUDE CODE

### Prerequisites (must be done first)
- [ ] Repo is on GitHub
- [ ] Fonts are in `/fonts/`
- [ ] Logo SVGs are in `img/logo/`
- [ ] At least the hero photo is in `img/hero/` (service + gallery can come later)

### Step 1 — Open Claude Code in your terminal
```bash
cd lev-yam
claude
```

### Step 2 — Paste this exact prompt:

```
Please build the complete Lev Yam website according to the build specification in docs/lev_yam_claude_code_instructions.md.

Instructions:
1. Read the ENTIRE spec document before writing any code
2. The spec is the single source of truth — follow it exactly
3. Build in this order: index.html → css/styles.css → js/app.js
4. Use placeholder <div> blocks for any missing images, clearly labeled
5. All real details (phone, email, WhatsApp, maps) are already in the spec — do not invent replacements
6. Build the complete site in one pass — all sections, all Hebrew copy from §6

The real details already in the spec:
- WhatsApp: +972506669138
- Phone: 050-6669138
- Email: info@levyam.com
- Domain: levyam.com
- GPS: 32.5435, 34.9078
- Waze: https://waze.com/ul/hsvbc45ng5
- Google Maps: https://maps.app.goo.gl/fFtCZYwK1KEcmFud6
- Instagram: @levyam_
- Facebook: https://m.facebook.com/profile.php?id=61585790351617
```

### Step 3 — After the build
1. Open `index.html` in Chrome — check it looks right
2. Replace placeholder image blocks with real photos
3. Run `LAUNCH_CHECKLIST.md` top to bottom
4. Deploy to Netlify (drag the folder) or push to GitHub Pages

---

## QUICK ACTION LIST

**This week:**
- [ ] Ask Elad for 3 SVG logo files
- [ ] Download + convert Heebo and Assistant fonts

**Before photo shoot:**
- [ ] Review shot list in §2.3 above
- [ ] Make sure Nimer is available for food photos

**Before Claude Code:**
- [ ] Fonts in `/fonts/`
- [ ] Logo SVGs in `img/logo/`
- [ ] At least the hero photo ready

**Day of build:**
- [ ] Run Claude Code with the prompt in Step 2
- [ ] Drop in real photos
- [ ] Run launch checklist
