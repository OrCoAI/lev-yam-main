# Lev Yam — Project Tracker

**Last updated:** April 2026
**Website:** levyam.com
**Status:** Code complete — assets & hosting needed before launch

---

## ✅ Done

| Item | Notes |
|---|---|
| Full site built (HTML/CSS/JS) | Single page, no frameworks |
| Hebrew copy | All sections written |
| RTL + accessibility | `lang="he" dir="rtl"`, skip link, ARIA, keyboard nav |
| Hero section | Wordmark, styled headline, scroll cue, WhatsApp CTA |
| 5 service cards | Centered layout, placeholders ready for photos |
| המרחב section | Two-column top-aligned layout with photo placeholder |
| למה לב ים section | Village story + features |
| Gallery + lightbox | 12 placeholders, keyboard navigable |
| FAQ (10 questions) | Accordion, keyboard accessible |
| Contact section | Map embed + 4 WhatsApp action cards with brand icons |
| Footer | Minimal single-line bar — logo, tagline, contact, copyright |
| Header | Logo, nav, social icons (Instagram + Facebook), WhatsApp CTA |
| Logo | logo-full (header), logo-mono-nobg (footer), logo-mark (favicon) |
| Favicon | logo-mark.png + apple-touch-icon |
| Page title | לב ים | מרחב יזמות עסקית חברתית על קו המים |
| WhatsApp CTAs | All 12 buttons with correct pre-filled Hebrew messages |
| Map embed | Google Maps iframe + deep link |
| Social links | Instagram + Facebook in header and footer |
| JSON-LD schema | FAQPage + LocalBusiness structured data |
| Meta / OG tags | Title, description, og:image, og:locale |
| robots.txt | Allows crawling |
| Mobile responsive | All breakpoints: 900px, 800px, 700px, 640px, 400px |
| Animations | Reveal on scroll, reduced-motion respected |
| Floating WhatsApp | Sticky button always visible |
| .gitignore | .DS_Store and .claude/ excluded |
| Repo clean | Only active assets committed |

---

## ❌ Missing — Required Before Launch

### Photos & Video
| File | Folder | What to shoot |
|---|---|---|
| `hero-poster.webp` | `img/hero/` | Waves + fishing boats (1920×1080, ≤180 KB) |
| `hero.mp4` | `img/hero/` | 10–15s muted loop, same subject (≤6 MB) |
| `offsite.webp` | `img/services/` | Team around a table, daytime (800×600, ≤80 KB) |
| `community.webp` | `img/services/` | Casual group, sunset (800×600, ≤80 KB) |
| `private.webp` | `img/services/` | Celebration — table, food, people (800×600, ≤80 KB) |
| `rental.webp` | `img/services/` | Wide venue shot, golden hour (800×600, ≤80 KB) |
| `weekend.webp` | `img/services/` | Friday/Saturday atmosphere (800×600, ≤80 KB) |
| `space-overview.webp` | `img/space/` | Pergola + sea, wide angle (900×700, ≤90 KB) |
| `01–12-large.webp` | `img/gallery/` | 12 images across 4 themes (1600×1200, ≤180 KB each) |
| `og-image.jpg` | `assets/` | Social preview — logo + tagline + hero (1200×630, ≤200 KB) |

**Photography rules:** Every service card photo must show at least one person. Natural light always preferred.

### Fonts
| File | Folder |
|---|---|
| `Heebo-Regular.woff2` | `fonts/` |
| `Heebo-Medium.woff2` | `fonts/` |
| `Heebo-Bold.woff2` | `fonts/` |
| `Assistant-Regular.woff2` | `fonts/` |
| `Assistant-SemiBold.woff2` | `fonts/` |

Download from [fonts.google.com](https://fonts.google.com) → convert TTF to WOFF2 at [cloudconvert.com/ttf-to-woff2](https://cloudconvert.com/ttf-to-woff2)

### Hosting
- [ ] Point `levyam.com` DNS to hosting provider
- [ ] SSL certificate active (HTTPS)
- [ ] Test live on real iPhone (Safari) + Android (Chrome)

---

## Next Session — When Assets Are Ready

1. Drop font files into `/fonts/`
2. Drop photos into their folders (paths above)
3. Swap placeholder `<div>`s with real `<img>` tags — search for `<!-- SWAP:` comments in `index.html`
4. Run `LAUNCH_CHECKLIST.md` top to bottom
5. Deploy to hosting + connect domain
