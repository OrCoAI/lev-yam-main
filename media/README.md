# `media/` — story photo intake

Drop original photos here (any size, JPG/HEIC/PNG). **Nothing in this folder is committed or
deployed** — `.gitignore` excludes everything but this file, because the repo is public and
`img/` ships to levyam.com as-is.

When a story page is written, the `story-author` skill lists what is here, the owner picks
one photo per page, and `scripts/story-images.sh <photo> <slug>` writes the three optimized
derivatives the template needs into `img/stories/<slug>/` — those are what get committed:

| File | Size | Used by |
|---|---|---|
| `card.jpg` | 1200×630 | `og:image` and the hub card |
| `hero-1600.jpg` | 1600×800 | the page hero (desktop) |
| `hero-800.jpg` | 800×400 | the page hero (phone) |

The script (Pillow; `python3 -m pip install pillow` once) applies the phone's rotation flag,
converts Display P3 colour to sRGB, and writes the derivatives from pixels only — phone
originals carry GPS coordinates, the capture time and often the photographer's name, and
these files go into a public repo and onto the site. HEIC originals are converted through
macOS `sips` first. It refuses a source under 1600×800 (the hero is the page's largest
image; upscaling ships blur). This table is the one place the sizes live.

Suggested habit: subfolders by subject (`media/team-days/`, `media/kitchen/`, `media/beach/`)
so a pick takes seconds. Keep only photos Lev Yam has the right to publish, with the consent
of anyone recognisable.
