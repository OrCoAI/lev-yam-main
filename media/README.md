# `media/` — a local cache of originals

**Originals live in the Drive fence** ([`content/README.md`](../content/README.md) §The two
halves); the weekly sort gives each one a media ID. This folder is only a **local cache** of
originals pulled down to make derivatives. **Nothing in it is committed or deployed** — `.gitignore` excludes
everything but this file, because the repo is public and `img/` ships to levyam.com as-is.

**Sizes live in one place: the presets in [`content/channels.json`](../content/channels.json)**
(`story-hero`, `story-card`, `gallery`, `services`, `share`, and the social presets). A story page
uses the `story-hero` and `story-card` presets:

| File | Preset | Used by |
|---|---|---|
| `card.jpg` | `story-card` | `og:image` and the hub card |
| `hero-1600.jpg` / `hero-800.jpg` | `story-hero` | the page hero (desktop / phone) |

`scripts/story-images.sh <photo> <slug>` writes them into `img/stories/<slug>/` and the new files
go on the photo's record in `content/media.json` (`renditions`, `used_in`, alt HE + AR). The
script (Pillow; `python3 -m pip install pillow` once) applies the phone's rotation flag,
converts Display P3 colour to sRGB, and writes the derivatives from pixels only — phone
originals carry GPS coordinates, the capture time and often the photographer's name, and
these files go into a public repo and onto the site (ADR 0069 §6). HEIC originals are converted
through macOS `sips` first. It refuses a source under the preset's minimum (upscaling ships blur).

Video clips and photos for reels follow the same path (`video/GUIDELINES.md` §8): originals in
Drive, a local copy here when needed, only derivatives committed — each one a rendition on a record.

Publish only photos Lev Yam has the right to publish — a recognisable person only within their
consent scope ([`content/README.md`](../content/README.md) §A media record).
