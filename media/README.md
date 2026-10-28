# `media/` — a local cache of originals

**Originals live in the Drive fence** ([`content/README.md`](../content/README.md) §The two
halves), reached through the synced folder; the weekly sort gives each one a media ID. This folder
is only a **local cache** — an original pulled down for a one-off, or a scratch output. **Nothing in
it is committed or deployed** — `.gitignore` excludes everything but this file, because the repo
is public and `img/` ships to levyam.com as-is.

**Every derivative is cut by [`scripts/media.sh`](../scripts/media.sh)** from the presets in
[`content/channels.json`](../content/channels.json) — the one home of sizes — after the record in
`content/media.json` says the use is allowed (consent scope, WhatsApp copy, kind). How to call it:
[`content/README.md`](../content/README.md) §Cutting derivatives. A story page's three files:

| File | Preset | Used by |
|---|---|---|
| `card.jpg` | `story-card` | `og:image` and the hub card |
| `hero-1600.jpg` / `hero-800.jpg` | `story-hero` | the page hero (desktop / phone) |

`scripts/story-images.sh <media-id> <photo> <slug>` writes them into `img/stories/<slug>/` and adds
them to the record's renditions. Needs Pillow (`python3 -m pip install pillow` once) and ffmpeg.

Publish only photos Lev Yam has the right to publish — a recognisable person only within their
consent scope ([`content/README.md`](../content/README.md) §A media record).
