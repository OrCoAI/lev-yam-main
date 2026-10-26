# Content — the content & media foundation (mandate item 1)

*Kickoff 2026-10-08 → 2026-10-12 (owner-led alignment; **Gate 1 approved 2026-10-12**) · branch
`content-media-foundation` ·
roadmap block: Phase 2 — 2026-Q4 mandate, **item 1** *(was 18)*
([ADR 0046](../decisions/0046-q4-2026-mandate-marketing-quarter.md), [0066](../decisions/0066-q4-mandate-order-content-media-first-items-16-to-18.md),
[0067](../decisions/0067-q4-mandate-renumbered-to-the-order.md)) · tier: **A** for all four PRs
per CLAUDE.md's table (A and D wire `.github/workflows/`; B and C touch the leash and `scripts/`) ·
decisions:
[ADR 0068](../decisions/0068-content-system-home-is-the-repo-one-fenced-drive-area-cowork-engine-retired.md),
[ADR 0069](../decisions/0069-every-published-piece-is-built-from-ids-and-recorded-content-records-additive-never-load-bearing.md)*

## Why

Everything Lev Yam publishes comes from four places that do not know about each other: facts in
`FACTS.md` (strong — one source, no prices), photos in `img/` (52 MB, every file referenced, none
indexed), a 263 MB unsorted `media/` intake on one Mac (77 camera-named files, 3 known to be used),
and about six Google Drive folders with nothing new since May 2026. Three image pipelines produce
three sets of sizes (`story-images.sh`, the `/app/events` upload, the video asset map); nothing
records which photo is used where, when a channel last got new material, or whether a face has
consent. The words are more scattered still: no channel profile text lives anywhere but inside
each app, no caption has been recorded since the April–June Instagram plan (whose tracker was never
filled in), and the writing rules sit across ADR 0053, a retired plan and memory notes. The
2026-10-08 inventory found eight live defects this scatter produced (§Inventory; PR A fixes them).
A second system had tried to fix this and went quiet on 2026-08-31 without anyone noticing
([ADR 0068](../decisions/0068-content-system-home-is-the-repo-one-fenced-drive-area-cowork-engine-retired.md)).

The owner's words at kickoff: *"we need to build a process where content is optimized from now
until forever"* and *"I want to build a great platform orchestration so I will be able to use it
with many other MCPs and connectors in an easy way."*

## Outcome metric

| | |
|---|---|
| Metric | **Weeks with a weekly pack posted on every live channel** (site/stories where the pack has one, Instagram, Facebook, Google Business Profile, WhatsApp Business) — primary. Secondary, read at the same check: `check-content.mjs` green on `main` (0 findings) · new photos in Drive `Media/20 Published` per week · minutes per Sunday session (the sort note's one number) |
| Source | a count over `content/posts/` (each posted piece is one entry; the owner marks it posted) · the CI check's last run on `main` · `content/media.json` rows by `published` date · `Records/` sort notes |
| Baseline (2026-10-12) | 0 of the last 4 weeks (nothing posted on any social channel since 2026-08-31; the site got story pairs only) · check does not exist · 0 photos/week · no session yet |
| Target | **3 of the first 4 weeks** after the first pack · 0 findings · ≥ 3 photos/week · ≤ 30 min/session |
| Check date | **2026-11-16** (planned first pack in the week of 2026-10-19, + 4 weeks; corrected at close-out to the real first pack + 4 weeks) — `weekly-review` lists it when due |
| Verdict owner | owner |

"Cannot tell" on the primary number means the owner did not mark posts — a finding about the pack's
"posted" step, not a pass. Social reach/saves are *not* a target here: nothing in the repo reads
them until mandate item 7; the Learn step uses what GA4 already has (UTM visits, `whatsapp_click`).

## The system in one picture

```
 CAPTURE ──► SORT & SHAPE ──► PICK ──► DRAFT ──► APPROVE ──► POST ──► LEARN ─┐
 phone,      Sunday session   2–3     HE + AR,  owner +     owner,    +7 days │
 team,       (owner + Claude) cards   media IDs Arabic      by hand           │
 designer,                            UTM links reader                        │
 guests                                                                       │
    ▲                                                                         │
    └── new idea cards · VOICE.md amendments · shot lists · retired cards ◄────┘
```

Three loops — **media**, **words**, **brand** — each with an Inbox, stages and an Archive (nothing
is deleted). Every output is a record naming its sources by ID
([ADR 0069](../decisions/0069-every-published-piece-is-built-from-ids-and-recorded-content-records-additive-never-load-bearing.md)),
so "where is this used / what did we say / what is still unused" is a query, not a memory.

## Homes

**Google Drive — the fence `Lev Yam — Content System/`** (ADR 0068 §3: Claude works only inside
it, never deletes; the owner's other folders are the owner's).

```
README                 the map + the rules, in Hebrew — for people and for tools
Ideas/                 00 Raw (anything: a line, a screenshot, a link, a voice-note transcript)
                       90 Shaped/<week> (originals move here once they became cards)
Media/                 00 Inbox · 10 Picked · 20 Published/<YYYY-MM> · 90 Archive · consent sheet
Brand/                 00 Inbox · 00 Rules · 10 Logos · 20 Icons · 30 Color & type · 40 Templates
                       50 Print · 60 Ideas (shortcut to the designer's workspace) · 90 Archive
                       + the designer guide (Google Doc)
Ready to post/<week>/  the pack: sized images per channel, HE + AR captions, UTM links, a "posted" box
Records/               sort notes (one number: minutes) · delivery log · ideas-private · review-reply
                       drafts · the retired Cowork documents
```

**The repo — the public-safe half.** Nothing live reads any of it at runtime (ADR 0069 §5).

```
FACTS.md                   unchanged — the only fact source
content/README.md          the content model: IDs, folders, the fence, roles, the rules every skill
                           reads first; states rules, never current values (ADR 0062)
content/VOICE.md           the writing rules that have no other home — the Arabic register, the
                           per-channel CTA / hashtag / emoji policy, what the loop learned — and
                           links for the rest (ADR 0053, CLAUDE.md's no-prices rule, FACTS.md's
                           spelling and "הגשר הכחול" wording, the no-names rules)
content/channels.json      every channel: status (live|planned), mode (read|draft|publish), connector,
                           size presets, caption limits, freshness rule, UTM source — THE one home of
                           sizes (media/README.md's table and video/GUIDELINES.md §2 become links)
content/channels/*.md      each live channel's profile text (bio, About, GBP description + services,
                           WhatsApp Business profile / greeting / away / quick replies, site meta)
content/media.json         every published image/clip: id, renditions (the committed derivative
                           paths in img/, video/public/), alt he/ar, used-in, consent
                           (none|site|social|ads), published — no names, no locations, and never a
                           Drive file ID (ADR 0069 §1: the ID → Drive mapping is a sheet in the fence)
content/posts/<id>.md      every piece: media IDs, captions HE/AR, channel, `posted` (empty until
                           the owner marks it — the outcome metric counts this field), `expires`
                           where time-bound, UTM, the experiment hypothesis if any, results at
                           +7 days (totals only) — supersedes the video plan's publish log
content/backlog.md         shaped idea cards · content/calendar.md  seasonal hooks 4–6 weeks ahead
brand/README.md            the brand rules in words (clear space, minimum size, do/don't, icon meanings)
brand/tokens.json          colours, fonts, spacing — a SOURCE: the check compares css/*.css custom
                           properties and video/src/theme.ts against it; nothing reads it at build
brand/assets/              the logo and icon masters with IDs — a SOURCE: `media.sh --brand` copies
                           the served files into img/logo, img/icons and video/public/brand, which
                           stay the served paths (ADR 0069 §5; GUIDELINES §8 amended to say so)
scripts/media.sh           the one image/clip script; presets from channels.json; story-images.sh
                           becomes a thin call into it
scripts/check-content.mjs  CI: records ↔ files · page alt == record alt, HE + AR · facts vs pages ·
                           IDs never raw paths, and every ID matches its grammar · consent scope
                           covers the use · weight budgets · expiry · no prices and no PII patterns
                           anywhere under content/ · no Drive-ID-shaped string under content/ ·
                           `publish` only with an existing `publish_adr` (ADR 0068 §2)
```

**IDs — four kinds, each with its own grammar, no two overlapping in shape** (ADR 0068 §5: validated
before any path or shell use; the occasion is a kind of event, never a name):

| Kind | Grammar | Example |
|---|---|---|
| media | `^\d{4}-\d{2}-[a-z][a-z0-9-]*-\d{2}$` | `2026-10-team-day-07` |
| post | `^\d{4}-\d{2}-\d{2}-(site\|ig\|fb\|gbp\|wa)-[a-z0-9-]+$` | `2026-10-19-ig-sunset-table` |
| brand asset | `^brand-[a-z]+-[a-z0-9-]+$` | `brand-logo-full-cream` |
| card | `^card-[a-z0-9-]+$` | `card-nimer-morning` |

The post ID is also the UTM campaign — the join key between a post and GA4.

## Scope — the thinnest slice that runs the loop every week

Four PRs, each usable on its own. Order chosen so the live defects go first and the first pack goes
out in week 2.

**PR A — live fixes + the check (Tier A because it wires `ci.yml`; otherwise `index.html`, `js/`,
`css/`, the two story templates).** Fixes the §Inventory list by hand as a stopgap until PR B's
records take over:
- Gallery alts for 01, 11, 13 corrected from the photos, HE + AR (`index.html` + `js/app.js`
  `gallery_descs`); `gallery/11` (identifiable children) stays — consent confirmed by the owner,
  2026-10-12 (open question 2).
- Weekend hours on the homepage from `FACTS.md`, `openingHoursSpecification` in the `EventVenue`
  JSON-LD; the long Maps link replaced by the short place link — on the homepage by hand; for
  the 22 other files, four template edits (`stories/_template.html`, `_template.ar.html` — the
  chrome source, ADR 0049 — and `stories/_hub.html`, `_hub.ar.html`, which carry their own
  copy), then `node scripts/gen-stories-index.mjs` restamps the story hubs and pages and
  `node scripts/gen-happening.mjs --stamp` the happening hubs and item templates; "ג׳יסר" →
  "ג'סר".
- Weight: a phone rendition of the hero (720p, ~3 MB, `<source media>`), `srcset` + WebP for the
  gallery and services, correct `width`/`height` per file, a 1200×630 share image.
- `scripts/check-content.mjs` v1 in `ci.yml`: alt present in both languages; facts vs pages (hours,
  phone, email, spelling, coordinates, Maps link); no price patterns; weight budgets and the
  share-image size. Born with the fixes so they cannot regress. Every later rule (records, consent,
  IDs, Drive-ID strings, `publish_adr`) extends this one script.
- *As built (2026-10-14), for PR C to reproduce:*
  - WebP renditions came from a one-off Pillow pass, not a committed script: EXIF orientation applied,
    pixels only, `quality=80, method=6`, widths 480 and min(original, 960), named by real width.
    `media.sh`'s `gallery`/`services` presets must reproduce these. `07`, `09` and `10` are rebuilt
    when their WhatsApp-compressed sources are replaced by Drive originals.
  - 13 served JPEGs carried EXIF (6 with GPS — all at the venue — plus device and capture time).
    They were stripped (10 losslessly; 14, 15 and `weekend.jpg` rotated into their pixels and
    re-encoded at q90, sRGB). The check's `meta` rule keeps it that way. Git history keeps the old
    blobs; no rewrite (the coordinates are the venue's own).
  - Phone hero: `img/hero/hero-portrait.mp4`, a centre 608×1080 crop of `hero.mp4` (H.264 CRF 29,
    no audio, faststart), 2.5 MB vs 10 MB, served by `<source media>` to portrait phones.
    Share image: `img/og/levyam-share.jpg`, a 1200×630 crop of gallery 18.
  - The check also found the homepage's static Hebrew and `js/app.js` `dict.he` must be one source:
    the `i18n` rule now compares all 77 keyed elements plus the gallery alts and labels.
  - Follow-ups for PR C: a portrait poster plus a media-gated `<link rel=preload>` (phones still
    preload the 308 KB landscape poster); `gen-stories-index.mjs` should write the stamped chrome
    back into `stories/_hub*.html` like `gen-happening --stamp` does, so a chrome edit is two files,
    not four.

**PR B — fence, records, brand, voice (Tier A; `.gitignore`, `content/`, `brand/`, `CLAUDE.md`,
`docs/ARCHITECTURE.md`, `video/GUIDELINES.md`, docs).**
- The Drive tree with its README; the one-time migration (read + copy only, originals untouched,
  ADR 0068 §3) from the six owner-approved sources — `תמונות מתחם`, `תמונות א.נשים`, `תמונות`,
  `סרטונים`, `אירועים עסקיים`, `עיצוב - מיתוג - תוצרי שיווק` — plus local `media/`:
  de-duplicated, IDs assigned, faces flagged for the owner's consent answers, WhatsApp-compressed
  copies kept apart (~~"never a source"~~ — since 2026-10-23 a last-choice source where the size
  fits, ADR 0069 amended).
- `content/media.json` for every file already in `img/` (alt from the pages, renditions); the
  ID → Drive mapping and the consent answers as one sheet in `Records/`; the check gains "page alt
  == record alt", "consent scope covers the use", "no Drive-ID-shaped string under `content/`" and
  the PII / price patterns over `content/**` (captions, quick replies and GBP services are the
  likeliest leak paths; priced offers stay in `Records/`).
- Brand: the designer's finals *copied* into `Brand/` under the owner's account (a copy is owned by
  whoever makes it; the designer stays editor and delivers to `Brand/00 Inbox`; their workspace is
  linked from `60 Ideas`, never used as a source — a later transfer, if the designer does it,
  retires the duplicates into `Archive`). `brand/README.md` + `tokens.json` + `assets/`; the Hebrew
  designer guide (deliver to `00 Inbox`, naming, delivery log, the starting list: vector masters,
  the Futura licence decision, a one-page usage text, empty template masters, icon names; the
  monthly look and seasonal proposals). The brand-book PDF is untracked (it stays in
  `Brand/00 Rules`; history keeps the blob).
- `content/README.md`, `VOICE.md`, `channels.json` (every channel `draft` on 2026-10-12),
  the channel profile files as they are today (read off each app by the owner), `backlog.md` seeded
  from the story backlog and the retired ideation list, `calendar.md`.
- Doc edits that carry the new rules: `docs/ARCHITECTURE.md` lifts "additive, never load-bearing"
  out of §6b into a general statement that binds telemetry and the content records (ADR 0013 and
  0069 both point at it); `CLAUDE.md` gets a `### Content` conventions block (fence, IDs, data not
  instructions, consent scope, draft-only, the one sizes home) and its stories line stops naming
  `media/` as the intake; `media/README.md` and `video/GUIDELINES.md` §2 point at `channels.json`
  for sizes (the weekly refresh job's §2 edits move to the presets); GUIDELINES §8 (brand assets)
  and §9 (publish log → `content/posts/`).
- Cowork retirement (ADR 0068 §1): the owner disables the two scheduled tasks; the engine document
  and its outputs move to `Records/`.
- *As built (2026-10-21), for PR C to build on:*
  - **Records.** `content/media.json` holds 38 records — every original behind a file in `img/`
    (gallery 18, services 5, the hero clip, the story photos and clips); a record groups all its
    renditions (gallery 18 also owns the share image and the `dugma` hero, which are crops of it).
    IDs use the sort month `2026-10`; `published` is the month git first saw a rendition. Each
    record carries **`people`** (`none | not-recognisable | adults | children`) beside `consent` —
    consent alone cannot tell "no face" from "no answer". `used_in` is recomputed by the check
    over the served pages, `js/` and `css/`.
  - **Consent answered by the owner 2026-10-21:** scope `site` for all 24 records with
    recognisable people (adults and children); none has `social` yet — a social post of one of
    them needs a fresh yes first.
  - **Brand.** `brand/assets.json` names 10 brand assets and owns `img/logo/`, `img/icons/`, the
    homepage logo build `img/hero/h*.png` and `video/public/brand/`. No vector master exists
    anywhere (the designer delivered PNG/JPEG), so `brand/assets/` waits for the designer guide's
    item 1. `tokens.json` = the brand book's three colours + the site's derived shades.
  - **Check v2** (`scripts/check-content.mjs`): records ↔ files, ids, used, alt (HE + AR, the
    homepage's Arabic through the dictionary), consent, channels (+ a profile file per live
    channel), posts, drive, pii, tokens — each rule proven by a planted violation.
  - **Drive.** The fence and its tree were created 2026-10-21 with the Hebrew README, the designer
    guide, the sort-notes and delivery-log sheets. The migration copied the four media folders into
    `Media/00 Inbox/migration 2026-10/` (by source, WhatsApp copies apart) and the designer's
    finals + the business-event flyers into `Brand/` (de-duplicated, originals untouched). The
    one media register (ID → Drive file, consent) is a sheet in `Records/`; the 38 published IDs
    are in it with the Drive original **not yet matched** — hash-matching through Drive for
    Desktop is blocked by macOS privacy settings, so the first `media-intake` session matches them
    by eye. Local `media/` (77 files, 263 MB) is too big for the connector: the owner drags it
    into `from local media (owner uploads)`.
  - **Sizes.** `channels.json` presets are the one home; `media/README.md` and
    `video/GUIDELINES.md` §2 point at them. The weekly refresh job still writes only
    `GUIDELINES.md`: a platform size change is proposed there as a line and the owner applies it
    to the preset — no workflow change.
  - **The site is `draft` too** — Claude opens the PR, the owner merges; no channel is `publish`.

**PR C — the script and the weekly session (Tier A; `scripts/`, `.claude/skills/`, `video/`).**
- `scripts/media.sh <id> <preset…>`: one Pillow/ffmpeg path for every derivative — the story trio,
  gallery `srcset` rungs + WebP, `ig-post` 1080×1350, `ig-reel`/`story`/`wa-status` 1080×1920,
  `fb`, `gbp` (≥ 720 px, 4:3), clip renditions — pixels only (ADR 0069 §6), one quality table, a
  minimum-size refusal per preset; for a `whatsapp: true` record a light clean-up pass (de-blocking
  and tone, local only, never upscaling) and a refusal for any preset with `"whatsapp_ok": false`
  (ADR 0069, amended 2026-10-23). ffmpeg runs with `-map_metadata -1` (it copies input metadata by
  default) and maps only the video and audio streams (`-map 0:v:0 -map 0:a:0? -dn -sn` — a phone's
  data tracks can carry GPS); the check's `meta` rule widens from JPEG to WebP and MP4 and also
  refuses JPEG comment segments. `story-images.sh` calls it. The `/app/events` upload's sizes
  join the same preset table and the check asserts they agree with the renderer (ADR 0059).
- Skills: **`content-week`** (the Sunday session: Inbox sort with faces to confirm → ~5 new cards
  marked `source: claude` → picks against the themes (ADR 0070) and the calendar → the pack drafted HE + AR
  with one declared experiment → the Arabic reader's comment thread → "posted" boxes) and
  **`media-intake`** (the sort alone, for a day when photos arrive and no pack is due). Both carry
  ADR 0068 §5's data-not-instructions list verbatim and the fence rule, and a 3-case `EVALS.md`
  whose cases include a planted instruction in a filename, in a Doc and in an image. `media.sh`
  and the check validate every ID against its kind's grammar (§IDs) before any path or shell use. `story-author` and `new-video` read `VOICE.md`, reference media by ID and
  stop naming `media/`; `video/scripts/sync-assets.mjs` resolves IDs through `media.json`
  renditions and `brand/assets/` instead of its hand-kept map; the two existing briefs
  (`video/briefs/moments-by-the-sea.md`, `video/briefs/team-day-guests.md`) are re-pointed.
- The first pack goes out of this PR's session.
- *As built (2026-10-24), for PR D and the first sessions:*
  - **`scripts/media.sh <id> <source> <out-dir> <preset>[=<stem>] … [--focus …]`** — Python
    (Pillow) inside a bash shell like `story-images.sh`, ffmpeg for clips and the WhatsApp pass.
    It reads the record before anything else: consent per preset (site / social), `whatsapp_ok`,
    kind; every size is checked against `min_source` (the source region that reaches the frame;
    absent = the preset's largest size) before the first file is written. Sources only from the
    fence's synced folder, the `media/` cache or the record's own renditions; social presets write
    only into the fence or the cache, site presets may write under `img/` and are appended to the
    record's renditions. Clips: autorotated, cropped by an expression of the decoded frame (a
    phone's coded size can carry a crop), one video + one audio stream, frame side data deleted,
    every tag but the container's brand removed, then re-probed and refused if anything survived.
  - **The WhatsApp pass** = ffmpeg `deblock` (weak, 8 px) + a light spatial `hqdn3d` in planar RGB
    (no colour conversion), then a luminance-only autocontrast at 0.2 %. Proven on gallery 07: the
    blocks soften, nothing smears, colour does not shift.
  - **Presets** gained `quality` (one table: jpg 82, webp 80, mp4 CRF 20), `stem` (`card`, `hero`),
    `fallback_long_edge` (gallery/services' JPEG web copy, ≤ 1600), `made_by` (`cover` is Remotion's,
    `events-photo` the `/app/events` upload's — media.sh refuses both) and a `min_source` for each
    social size: ig-post / fb 864×1080, story / wa-status 810×1440, ig-reel 720×1280,
    ig-feed-video 720×900 (at most ~1.25–1.5× of upscaling; a 1600×1200 landscape is refused for a
    9:16 story — use a portrait).
  - **`story-images.sh <media-id> <photo> <slug>`** is a thin call into `media.sh` — the ID and the
    record now come before the cut.
  - **Check v3:** `meta` covers every committed rendition — JPEG EXIF/XMP/IPTC/comments, WebP
    EXIF/XMP, PNG eXIf/text, an MP4's location, Apple camera keys, capture time or data track; it
    found and the PR stripped, byte for byte with identical pixels, the encoder comment on the five
    video posters, `Software: Picasa` on `video/public/photos/terrace.jpg` (outside the old rule's
    reach) and resolution `eXIf` on the three logo PNGs — nothing personal in any of them. `sizes`
    validates the presets; `briefs` fails a reel brief that names a raw file and an asset-map
    entry that is not a media / brand ID. Each rule proven by a planted file.
  - **The reels' asset map** moved to `video/assets.json` (name → ID; `sync-assets.mjs` and the check
    both read it) and resolves to the record's first rendition in that format that is not a sized
    cut — the same 12 files as before. Both briefs re-pointed;
    `team-day-guests`' originals get their IDs at the first `media-intake` (their Drive names stand
    in until then).
  - **Two doors into the fence** (ADR 0068 amended 2026-10-24): the connector for documents, the
    synced folder for bytes; the register and sort notes become CSV files in `Records/` (neither
    door edits a Google Sheet), converted on the first session.
  - **The gate's findings, fixed:** clip sources are read by ffmpeg's MOV/MP4 reader only (a
    `.m3u8` playlist in the Inbox could otherwise pull any local file into a cut); consent fails
    closed on an unknown `people` value; nothing in the fence is overwritten; clips are converted to
    BT.709 SDR (iPhone HLG and Display P3 passed through before; no `zscale` here, so HLG goes
    through `colorspace` as BT.2020 — HLG's own SDR fallback — and PQ is refused); a phone clip's
    size is measured on the decoded frame (its coded size carries a crop ffprobe does not apply);
    `video/public/photos` and `private` are media.sh destinations held to `social`. The check's
    `meta` rule fails any other committed format, data after a JPEG's end and MP4 text tags; the raw
    file rule catches `/img/…` paths; the asset map is resolved as `sync-assets` resolves it.
    `scripts/media-inbox.py` indexes the Inbox by number with previews and moves by number with a
    sha256 check, so an uploaded file's name never reaches a shell command (and macOS `mv -n`'s
    silent clash cannot leave a register row pointing at the wrong photo).
  - **Found on the way, for the owner:** three reels in `video/` show photos whose consent is
    `site` only — `2026-10-weekend-02` and `-04` (children) and `2026-10-sunset-03` (adults). A
    reel's post record lists every media ID it shows, so none of them can be marked posted before
    the owner's `social` answer.
  - **Not in this PR:** PR A's two follow-ups (a portrait hero poster with a media-gated preload;
    `gen-stories-index.mjs` writing stamped chrome back into `stories/_hub*.html`) — both change
    deployed pages and wait for their own small Tier-B PR; `media.sh --brand` waits for the
    designer's vector masters; the story clips (`clip.mp4` / `clip-540.mp4`) are not a preset yet.

**PR D — learn + freshness (Tier A; `.github/workflows/`, `scripts/analytics-snapshot.mjs`).**
- `analytics-snapshot.mjs` adds a per-`utm_campaign` breakdown (sessions, `whatsapp_click`) in the
  fixed pre-agent step (ADR 0047: the key never reaches the agent step; no Drive scope is added to
  Actions), keeping only values that match an existing `content/posts/<id>.md` (ADR 0069 §3).
  Transport: the step uploads `.reports/analytics.json` as a workflow artifact; `content-week`
  fetches the latest with `gh run download` (allow-listed in `.claude/settings.json`, same PR) and
  writes the totals onto each post record — the report agents still hold no write (ADR 0048).
- Freshness numbers computed from the records (days since the last photo / pack per channel, photos
  added per week, backlog depth, cards older than 8 weeks) into the weekly report's data file for
  mandate item 2 to carry; the engineering weekly links to it.

## The weekly rhythm — the owner's time, about 45 minutes a week

| When | What | Who | Time |
|---|---|---|---|
| any time | photos → `Media/00 Inbox`; ideas → `Ideas/00 Raw` (phone, Drive app or Files) | owner, team | seconds |
| Sunday | `/content-week`: sorted Inbox + faces to confirm, 5 new cards, this week's picks, the drafted pack — yes/no per item | owner + Claude | ~30 min |
| Sunday | Arabic sign-off on every caption (Drive comment; ADR 0069 §7) | owner (the Arabic reader) | inside the session |
| Tue–Sat | post from `Ready to post/<week>`, tick "posted" | owner | ~3 min per channel |
| +7 days | results per post from the snapshot; winners remixed, losers retired, rules proposed | Claude, next session | inside the 30 min |
| monthly | the deeper audit: theme split vs ADR 0070, what worked, stale cards retired, channel profiles vs FACTS, the designer's look | owner + Claude | ~60 min |
| quarterly | hero video refresh, `VOICE.md` review, skill evals | the quarterly review | — |

A skipped week breaks nothing: the pack carries over, the freshness number shows it.

## What makes it evolve

1. **Measured feedback becomes rules.** Results are written on each post record; the monthly audit
   turns patterns into `VOICE.md` amendments and theme shares — proposed as a PR, never applied
   unasked.
2. **One deliberate experiment per pack** with a written hypothesis (hook, format, posting time,
   language-first, CTA wording), judged at +7 days. Reels already do this with two hook variants.
3. **Claude's own ~5 cards a week**, each with its source: the calendar, consented photos not yet
   used, questions guests asked on WhatsApp (the owner pastes themes; `feedback-triage` feeds the
   monthly batch), queries Search Console shows at positions 5–15, review themes, village facts no
   page has told (ADR 0063), the designer's `60 Ideas`.
4. **Winners are remixed across channels** (post → reel → GBP post → story topic), each in that
   channel's preset.
5. **Backlog hygiene**: cards not picked for 8 weeks are archived; the backlog never holds fewer
   than 10 shaped cards (the check warns).

## Roles and access

| Who | Drive | Repo | Does |
|---|---|---|---|
| owner | everything in the fence | everything | approves, posts, decides |
| Claude (owner's sessions) | the fence only; never deletes | PRs through the gate | sorts, shapes, drafts, records, checks |
| the automated agents (GitHub Actions) | none (ADR 0068 §2) | read the records as files | the CI check, freshness numbers |
| Nimer | — | — | verifies any sentence attributed to him before it is published |
| the Arabic reader = the owner (ADR 0069, amended 2026-10-14) | comments on `Ready to post` | — | signs off every Arabic caption |
| the designer | editor on `Brand/` | — | delivers to `Brand/00 Inbox`, monthly look, seasonal proposals |
| a future social helper | reads `Ready to post` | — | posts the pack (when the owner delegates) |
| team members | upload-only to `Media/00 Inbox`, `Ideas/00 Raw` | — | add photos and ideas |

## Explicitly out of scope

- **Claude publishing** to any channel — ADR 0068 §2: `publish` mode needs its own ADR, Tier A and
  a security review (the owner, 2026-10-08: "later on I will want to give Claude the ability").
- **Reading social / GBP back** (reach, saves, reviews, live profile drift) — mandate item 7; the
  gap check "a live post not in the record" starts there. Until then the Sunday session asks
  "anything posted outside the pack?".
- **A scheduled cloud routine that pre-drafts the Sunday session** (reads Raw/Inbox/GA4, writes
  only into `Ready to post/`) — would cut the owner's session to ~15 min but runs a connector
  unattended (ADR 0068 §2). Decide after four packs, as its own ADR.
- **A channel-spec refresh job** (the ADR 0064 pattern proposing preset amendments by PR when
  Instagram / Meta / GBP change something) — the follow-up Tier-A PR after D.
- **The paid test and the Monday paid review** — item 8 decides their home.
- **English content** — out this quarter (roadmap).
- **A `/app` content module** (the queue of drafts as platform data) — later phase; `idea-capture` if
  it comes up.
- **Moving large media out of git** — parked with a trigger (open question 6).
- **Rewriting git history** to drop the brand-book blob or old media versions — not worth a
  force-push on a protected branch; the files are untracked going forward.
- **Audio, music rights for reels** — stays as `video/GUIDELINES.md` has it.

## Schema, RLS, permissions

None; nothing touches `supabase/`. The `/app/events` upload's explicit metadata strip is logged in
[modules/events.md](../modules/events.md) as a follow-up.

## UI surface

PR A only: the homepage in HE and AR (gallery, services, hero, hours, map link) and the chrome
footer on one story page and one initiative page per language — step zero per ADR 0008/0009.

## Rollback

Revert the PR(s) (ADR 0069 §5). The Drive fence is archived, not deleted; the migration copied and
never moved, so every original is still where it was. `story-images.sh` keeps its interface, so a
revert of `media.sh` leaves story authoring working. The Cowork tasks, if wanted back, are
re-enabled by the owner.

## Checks

- **Roadmap:** item 1 of the current block, in the owner's order (ADR 0066/0067); this plan is
  linked from the item's line. Items 2, 5 and 7 consume what this builds (the freshness numbers,
  the GBP weekly part, the read connectors) — stated in each line already.
- **Architecture:** invariants 1, 2, 4, 6, 7 not touched (no tables, no keys, no live tool).
  **3 (no PII in the public repo):** `media.json` carries no names or locations; consent answers
  are a Drive sheet; review replies, priced offers and customer quotes live in `Records/`; every
  derivative is written from pixels only (ADR 0069 §6); the check refuses price patterns — verdict:
  holds, and strengthened (the check is new). **5 (HE + AR):** every caption, alt and profile text
  exists in both languages and the Arabic reader signs off before posting (ADR 0069 §7) — verdict:
  holds. **8:** roadmap updated in this PR. PR B writes the "additive, never load-bearing"
  statement into ARCHITECTURE.md as a general one (ADR 0069 §5). The automation rules of
  ADR 0047/0048 are kept (ADR 0068 §2).
- **Vision:** serves the **Create** circle's marketing face and principle 4 (public by default —
  the venue's life visible and current) and principle 5 (bilingual from day one); principle 7
  (evolution, not revolution) is why nothing is deleted and the retired outputs are kept. Must not
  break principle 1's spirit: guests appear with consent, never named. Verdict: aligned.

## Open questions

Blocking:
1. ~~**The Arabic reader**~~ — **answered 2026-10-14: the owner (Or) signs off**, no dedicated
   reader (ADR 0069 amended).
2. ~~**Consent for `gallery/11`**~~ — **answered 2026-10-12: consent exists** (owner); the photo
   stays, the consent sheet records scope = `site` at the migration, PR A only fixes its alt.
3. ~~**Themes and freshness numbers**~~ — **answered 2026-10-14** (owner):
   - **themes are audiences** — Companies & teams 45% · Private hosts 25% · Space renters 15% ·
     Weekend visitors & community 15%; the village, the sea and the kitchen are the setting of
     every post, not a theme ([ADR 0070](../decisions/0070-content-themes-are-audiences-business-first-the-place-is-the-setting-of-every-post.md));
   - **freshness confirmed as drafted:** ≥ 3 new photos/week in `Published` · one pack/week on every
     live channel · GBP a photo and a post weekly · gallery swap ≥ 2 photos monthly · story facts
     re-checked every 90 days (from the page's `levyam:updated` stamp) · hero video quarterly ·
     channel profiles checked against `FACTS.md` weekly · nothing date-bound visible past its
     `expires` date.

Non-blocking:
4. ~~Can the Drive connector move files between folders?~~ — **answered 2026-10-21: yes** (a parent
   change), so a move is a move; `content/README.md` and the Drive README say so.
5. The Futura licence — buy, or approve Heebo/Assistant as the brand web fonts (owner + designer).
6. Big-media trigger: clips move to object storage when `img/` passes 100 MB or story montages
   become routine (owner confirms the number; roadmap "Parked until a trigger").

## Inventory (2026-10-08) — the fix list PR A works from

- **Alt describes the wrong photo** (HE + AR, `index.html` + `js/app.js` `gallery_descs`):
  `img/gallery/01.jpg` (an aerial of the harbour; alt says sunset with a boat), `11.jpg` (children
  with a puppy on the beach; alt says aerial view), `13.jpg` (a woman and two girls by the house;
  alt says a local meal). Likely broke when the files were renamed 01–15.
- **Identifiable people** in `img/gallery/07.jpeg` (a group of women), `11.jpg`, `13.jpg` and `14.jpg`
  (children); consent confirmed by the owner for 11 on 2026-10-12 and for 07, 13, 14 on 2026-10-14 —
  PR B's consent sheet records all four as scope `site`.
- **Weekend hours** (FACTS: Fri 10:00–15:00, Sat 10:00–sunset) appear on no page; the `EventVenue`
  JSON-LD has no `openingHours`; `happening/_fixture.json` says 11:00–17:00.
- **The long Google Maps link** carries a Tel Aviv viewport (`@32.0867773,34.76303`) in 23 files:
  `index.html`, the two happening hubs, the two happening item templates, the two story hub
  templates (`stories/_hub*.html`), the two generated story hubs, the two story templates and the
  12 story pages (6 pairs) — `stories/_template*.html` is the chrome source for everything but
  `index.html`. The map pin (`data-lat/lng`) is ~28 m from the FACTS coordinates.
- **Spelling:** "ג׳יסר" 9× in `index.html`, 7× in `js/app.js`; FACTS and stories use "ג'סר".
- **WhatsApp-compressed copies** serving as site photos: `img/gallery/07.jpeg`, `09.jpg`, `10.jpg`
  (byte-identical to Drive's `PHOTO-2026-04-18…`, and two sibling WhatsApp files).
- **Weight:** `img/hero/hero.mp4` 10 MB, 1920×1080, downloaded in full by phones; the gallery has
  no `srcset`/WebP and declares 900×675 for 8 portrait files; the share image is the 600×599 logo.
- **The brand-book PDF** `docs/ספר מותג - לב ים.pdf` (13.7 MB) is tracked in the public repo.
- `media/`: 77 files, 61 of them a "Lev Yam - Event - N of 41" Live Photo set; only "Event 3, 4, 5
  of 41" are known to be used (`video/briefs/team-day-guests.md`). The sources of the six
  stories' photos and clips are not recorded anywhere.

## Decisions made on the way

- 2026-10-08 · the content system's home is the repo; connectors in the owner's sessions only, no
  channel in `publish` mode without its own ADR; one fenced Drive area; the retired marketing
  engine · [ADR 0068](../decisions/0068-content-system-home-is-the-repo-one-fenced-drive-area-cowork-engine-retired.md)
- 2026-10-08 · every published piece is built from IDs and recorded; the records are additive,
  never load-bearing; one derivative script, pixels only; consent has a scope; every public Arabic
  text on every channel is signed off by the native reader · [ADR 0069](../decisions/0069-every-published-piece-is-built-from-ids-and-recorded-content-records-additive-never-load-bearing.md)
- 2026-10-14 · the Arabic reader is the owner — no dedicated reader; §7's sign-off unchanged ·
  [ADR 0069](../decisions/0069-every-published-piece-is-built-from-ids-and-recorded-content-records-additive-never-load-bearing.md) amended
- 2026-10-14 · the content themes are audiences (Companies 45 · Private 25 · Renters 15 · Weekend &
  community 15), each tied to a service and one action; the place is the setting of every post ·
  [ADR 0070](../decisions/0070-content-themes-are-audiences-business-first-the-place-is-the-setting-of-every-post.md)
- 2026-10-08 · brand finals are copied into an owner-owned library, not transferred — an
  implementation choice recorded in PR B, no standing rule.
- 2026-10-21 · consent for every published photo with recognisable people (24 records, children
  included) is scope `site`, answered by the owner; social use needs a fresh yes — recorded in the
  register sheet and mirrored on the records (PR B)
- 2026-10-21 · media records carry `people` beside `consent`; brand assets own the logo / icon
  files through `brand/assets.json` — implementation choices inside ADR 0069, no standing rule
- 2026-10-21 · every piece is drafted in three caption versions — Hebrew, Arabic and mixed — and the
  owner picks which go out (`content/VOICE.md`; the check requires all three on a post record)
- 2026-10-21 · the migration registers the 38 published originals now and leaves the other
  migrated files to the weekly sorts (owner's pick of three depths)
- 2026-10-23 · WhatsApp copies are a last-choice source wherever the preset's minimum size fits,
  after a clean-up pass, never a story hero or its card; records carry `whatsapp: true`; the original is still
  chased · [ADR 0069](../decisions/0069-every-published-piece-is-built-from-ids-and-recorded-content-records-additive-never-load-bearing.md) amended

- 2026-10-24 · photos and clips move between Drive and the Mac through the synced folder
  (Google Drive for Desktop), never through the connector; the owner allowed VS Code to read
  Drive; the register and sort notes become CSV files in `Records/` ·
  [ADR 0068](../decisions/0068-content-system-home-is-the-repo-one-fenced-drive-area-cowork-engine-retired.md) amended
- 2026-10-24 · each social preset carries its own `min_source` (≤ ~1.25–1.5× upscaling); a preset
  another tool makes says `made_by` — implementation choices inside ADR 0069 §6, no standing rule

## Close-out
*(appended when done — CLAUDE.md "Roadmap item close-out")*

## Outcome check
*(appended on the check date: metric value vs target, verdict, what it changes)*
