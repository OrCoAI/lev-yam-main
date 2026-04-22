# לב ים — Lev Yam Website

Beachfront social entrepreneurship space in the fishing village of Jisr az-Zarqa.

**Website:** levyam.com  
**WhatsApp:** +972506669138  
**Email:** info@levyam.com  
**Instagram:** [@levyam_](https://www.instagram.com/levyam_?igsh=Y215ZjBnZDAxeHlp&utm_source=qr)

---

## Project Structure

```
lev-yam/
├── index.html          ← Main (and only) HTML page
├── css/styles.css      ← All styles
├── js/app.js           ← All JavaScript
├── fonts/              ← Self-hosted Heebo + Assistant woff2 files
├── img/                ← All images (hero, services, gallery, icons, logo)
├── assets/             ← og-image.jpg for social sharing
├── docs/               ← Source documents (brand book, spec, etc.)
└── robots.txt
```

## Tech Stack

Plain HTML5 + CSS3 + Vanilla JS. No build tools, no frameworks, no npm.  
Deployable to any static host: Netlify, Cloudflare Pages, GitHub Pages, S3.

## Build Instructions

See `/docs/lev_yam_claude_code_instructions.md` for the complete build spec.

## Fonts

Self-hosted Google Fonts (Heebo + Assistant). Download `.woff2` files and place in `/fonts/`.  
See `CHECKLIST.md` for the complete list of files needed before launch.

## Development

No build step needed. Open `index.html` in a browser, or serve locally:

```bash
npx serve .
# or
python3 -m http.server 8000
```

## Before Launch

Run through the full checklist in `LAUNCH_CHECKLIST.md`.

---

*Built April 2026*
