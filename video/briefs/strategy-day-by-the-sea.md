# Brief — A strategy day by the sea (`strategy-day-by-the-sea`)

*Written 2026-11-02 with the `new-video` skill · type: recap of real footage (the strategy day on
the live story page `strategy-offsite-by-the-sea`) · status: draft → approved (Gate 1 2026-11-02) → built →
reviewed (Gate 2 2026-11-02) → rendered → posted*

> This file is the complete prompt. A build session reads **`video/GUIDELINES.md`
> first**, then follows this brief shot by shot. Nothing on screen that is not written here.

> **Consent cleared 2026-11-04.** `2026-10-offsite-03` and `-04` read **`social`** with the owner's
> note in `content/media.json` and `Records/media-register.csv`. Posting still needs the Arabic
> sign-off and Gate 3.

## Spec

- **Composition ids:** `strategy-day-by-the-sea-he-question`, `strategy-day-by-the-sea-he-footage`, `strategy-day-by-the-sea-ar-question`, `strategy-day-by-the-sea-ar-footage` (one `<Folder name="StrategyDay">`)
- **Size / fps / length:** 1080 × 1920 · 30 fps · 12 s = 360 frames · Reels / Stories only (no 4:5 feed re-layout)
- **Languages:** HE and AR, both built now; the owner signs the Arabic off before posting (ADR 0069, amended 2026-10-14)
- **Audio:** none
- **Rules:** guidelines §3 (safe zone: `ZONE`, `<SafeZone />` on in Studio), §4 (type, RTL), §5 (motion), §6 (compose from the kit), §8 (a small source is a card) — as read on 2026-11-02 from `main` at `5501f8b`; the guidelines win where this brief and they diverge
- **Facts:** only the lines cited below; nothing invented; no prices; no names — not the group, not the people in the photos, no date of the day

## Goal

Show managers and HR planning a strategy day what one looks like at Lev Yam — small-group work
under the pergola facing the sea, the long work table, the circle on the sand — in twelve silent
seconds. **The one ask:** "כתבו לנו בוואטסאפ" / "اكتبوا لنا على واتساب" → WhatsApp `972506669138`
(shown in local form, 050-666-9138, as in `team-day-guests`).

## Facts used (source · line)

| On screen | Source |
|---|---|
| "יום אסטרטגיה" / strategy day | `FACTS.md` § שירותים: "אירועים עסקיים — ימי גיבוש, ימי אסטרטגיה, יציאה מהשגרה" |
| "מול הים", "תחת הפרגולה" | `FACTS.md` § המתחם: "פרגולה מול הים" |
| "עבודה בקבוצות קטנות, מול הים" | `/stories/strategy-offsite-by-the-sea/` read 2026-11-02: "לעבודה בקבוצות קטנות יש פינות ישיבה מגוונות, מדשאה והחוף עצמו"; the photo (`2026-10-work-05` alt): "שניים עובדים עם מחשב נייד ליד שולחן ארוך תחת הפרגולה, מול הים" |
| "סביב שולחן אחד" | `content/media.json` `2026-10-offsite-04` alt: "קבוצה יושבת סביב שולחן עבודה ארוך תחת הפרגולה" (what the photo shows) |
| "במעגל על החול" | `/stories/strategy-offsite-by-the-sea/` read 2026-11-02, the photo's caption: "שיחה במעגל על החול, ליד סירת דייגים." |
| "כתבו לנו בוואטסאפ" · 050-666-9138 | `FACTS.md` § זהות: "וואטסאפ: `972506669138`"; § שירותים: "הזמנה: הודעת וואטסאפ" |

Missing: none. No seasonal fact (no hours, no days, no date).

## Assets (by media ID)

New lines in `video/assets.json` (`site` map) — never a file dropped into `public/site/` by hand —
and one committed rendition in `video/public/photos/`:

| Shot | Name in `public/site/` ← media ID | Source size | Why this one · crop / focus |
|---|---|---|---|
| 1 | `offsite-window.jpg` ← `2026-10-offsite-01` (its gallery web copy) | 1200 × 1600 | two people from behind at the old window, the sea outside — the one tall source, so the only **full-frame** beat; people `not-recognisable`, consent `none` is enough · `objectPosition: "50% 45%"` |
| 2 | `photos/work-05.jpg` ← `2026-10-work-05` — cut by `scripts/media.sh … ig-post=work-05 --focus center` from the fence original (3024 × 4032, portrait), recorded on the media record | 1080 × 1350 (4:5) | two people working at the long table under the pergola, the boats and sea behind; consent `social` · a **portrait postcard**, 620 wide. (Gate 1 had `2026-10-offsite-02`, the plenary — swapped by the owner at Gate 2.) |
| 3 | `offsite-table.jpg` ← `2026-10-offsite-04` (its story hero, 1600 cut) | 1600 × 900 (16:9) | the long work table, the sea behind · postcard |
| 4 | `offsite-circle.jpg` ← `2026-10-offsite-03` (its story figure, 1600 cut) | 1600 × 900 (16:9) | the circle on the sand by a fishing boat · postcard |
| 5 | `logo.png` ← `brand-logo-mono` (mapped already) | | the end card |

- **Build note:** `-03` and `-04` have only sized cuts (the 1600 / 800 story cuts), which
  `video/scripts/sync-assets.mjs` skips (`SIZED_CUT`) and then fails on. Extend the rule in the
  same PR — *no unsized rendition → the widest sized cut* (and its mirror in
  `scripts/check-content.mjs`) — rather than adding a rendition to the records. The originals are "not yet matched" in the fence; if they turn up later, the cards
  stay cards.
- **Why cards:** cropped to 9:16 full-frame the landscape cuts would upscale ~2× (guidelines §8:
  a small source is a card, never stretched). At ~950 px wide each card is a downscale — sharp.
  `work-05` could fill the frame, but stays a card so the deck reads as one set of postcards.

## The postcard (a new kit part)

The kit has no framed-photo card; add **`PhotoCard`** to `video/src/levyam/parts.tsx` (not inside
the scene): an `<Img>` shown whole (`objectFit: "cover"` on its own aspect), its edge the brand's
zigzag stamp (`StampFrame` from `brand.tsx`, `C.card` fill, orange stroke — as the `postcard`
transition's stamp), a small fixed tilt prop (degrees, never mirrored), entering by
`spring({ damping: 200 })` from 60 px below + 0.96 scale. The 16:9 cards are **950 px** wide
(x 65–1015, the 6 % sides, 557 tall with the 26 px border), the 4:5 card **620 px** (762 tall); all centred on
**y 520** (a photo may cross the top band; text never), so a caption at the bottom of `ZONE`
clears the tallest card. The 16:9 cards land over the portrait one, its top and bottom showing. The cards **stack**: each lands on top of the last, which stays visible
underneath, offset by its tilt (−2°, +1.5°, −1°). Background `C.cream`. The caption sits under
the stack, bottom-anchored in `ZONE` (≤ y 1248), never over the photo — the right rail (x > 853,
lower 40 %) stays clear of text.

## Shots

Frame counts at 30 fps; transitions are 15 frames and shorten the timeline; overlays do not.
Total: 90 (hook) + 210 (deck) + 90 (end) − 15 (`postcard`) − 15 (`heartZoom`) = **360**.
(Build, 2026-11-02: the deck was 225 and the end 75 at Gate 1 — a 75-frame end card cannot settle
its title, line and number by local frame 29, so 15 frames moved from the deck to the end card;
the beats and copy are unchanged.)

| # | Seconds (frames, absolute) | Beat | HE copy (exact) | AR copy (exact) | Asset | Kit motion / transition in |
|---|---|---|---|---|---|---|
| 1A | 0–3.0 (0–89) | HOOK **question** | "עוד יום אסטרטגיה בחדר ישיבות?" | "كمان يوم استراتيجية بغرفة اجتماعات؟" [ar-draft] | `site/offsite-window.jpg` full-frame | `KenBurns` 1.00 → 1.06 from frame 0; `Words` from frame 0 (first word in at 0, the second mid-rise — §7); `Scrim` bottom; `MediaBeat` |
| 1B | 0–3.0 (0–89) | HOOK **footage** | frames 0–14: no text · from 15: "יום אסטרטגיה, מול הים" | "يوم استراتيجية، قبال البحر" [ar-draft] | `site/offsite-window.jpg` full-frame | same `KenBurns` (motion at frame 0 is the scroll-stop); `Words` from frame 15; `Accent` under the line |
| 2 | 2.5–5.0 (75–149; deck local 0–74) | SMALL GROUPS | "עבודה בקבוצות קטנות, מול הים" | "شغل بمجموعات صغيرة، قبال البحر" [ar-draft] | `photos/work-05.jpg` → `PhotoCard` 620 wide, −2° | `postcard` in (the window shot lifts into a stamp and flies off; the cream deck is underneath); card 1 lands local 0–20; caption `Words` from local 15 |
| 3 | 5.0–7.3 (150–219; local 75–144) | THE TABLE | "הדיון: סביב שולחן אחד" | "النقاش: حوالين طاولة وحدة" [ar-draft] | `site/offsite-table.jpg` → `PhotoCard` +1.5° | card 2 lands on the stack local 75–91; **hard cut** on the caption (the old line gone at 75, the new one `Words` from 75) |
| 4 | 7.3–9.5 (220–284; local 145–209) | THE CIRCLE | "והשיחה החשובה: במעגל על החול" | "والحديث المهم: بدايرة على الرمل" [ar-draft] | `site/offsite-circle.jpg` → `PhotoCard` −1° | card 3 lands local 145–161; hard cut on the caption |
| 5 | 9.0–12.0 (270–359) | END CARD | title "מתכננים יום אסטרטגיה?" · line "כתבו לנו בוואטסאפ" · "050-666-9138" in `<bdi dir="ltr">` | "عم تخططوا ليوم استراتيجية؟" · "اكتبوا لنا على واتساب" [ar-draft] · same number | `site/logo.png` on cream | `heartZoom` in (15 f); `SignOff` with `fitZone`; everything has landed at frame 315; **frames 315–359 hold still** (≥ 1.5 s) |

Everything after shot 1 is shared by both hooks. Captions use the kit's `TYPE` body/headline
tokens — no scene-local font size.

## Copy entries

`video/src/copy/he.ts` and `ar.ts` each get a `strategyDay` entry (a new `StrategyDayProps` zod
schema in `video/src/levyam/strategy-day/schema.ts`, `hook: "question" | "footage"`), every line
above verbatim; the Arabic lines carry `// [ar-draft]`.

## Acceptance (this reel's additions to `review.md`'s standard checks)

- [ ] Every fact on screen matches the Facts table above
- [ ] Hook 1B has **no text** on frames 0–14 and a moving image on frame 0; hook 1A has its first word in on frame 0
- [ ] No logo before the end card
- [ ] The three deck photos appear **whole, as cards** (never cropped full-frame) and are sharp at 1080 wide
- [ ] Each caption sits below the stack, inside `ZONE`; no text in the right rail; never two captions on screen at once
- [ ] Nobody is named anywhere — screen, copy file, brief, commit message; no date of the day
- [ ] The end card holds still for its last 45 frames and says the ask in words
- [x] `offsite-03/04` read consent `social` (owner, 2026-11-04)
- [ ] Arabic signed off by the owner before posting

## Render matrix

| Composition | File |
|---|---|
| `strategy-day-by-the-sea-he-question` | `out/strategy-day-by-the-sea-he-question.mp4` + `out/strategy-day-by-the-sea-he-cover.png` |
| `strategy-day-by-the-sea-he-footage` | `out/strategy-day-by-the-sea-he-footage.mp4` |
| `strategy-day-by-the-sea-ar-question` | `out/strategy-day-by-the-sea-ar-question.mp4` + `out/strategy-day-by-the-sea-ar-cover.png` |
| `strategy-day-by-the-sea-ar-footage` | `out/strategy-day-by-the-sea-ar-footage.mp4` |

Cover still: a deck frame with all three cards down and the circle caption (≈ frame 262), headline
inside the centre 4:5 crop (y 285–1635).

## Out of scope for this reel

- Sound, voice-over, music (v1 is silent)
- English; a 4:5 feed re-layout
- A second CTA (the story page URL, Instagram, "come Friday") — the owner may add Instagram's link sticker to the story page at posting time; it is not in the render
- Any price, capacity number, hours, or the date of the day
- The group's or any person's name; a quote from the day
- The sunset beat / "כשעה מתל אביב" (considered, left out to keep 12 s)
- The food (`kitchen-03` shows a person in a way that doesn't fit a business reel)

## Log

- 2026-11-02 — gate step 1 (`/simplify`) follow-ups, deferred because they change the shipped
  `team-day-guests` end card, whose pixel proof needs its private quotes file (kept in that reel's
  worktree only): (a) **one WhatsApp end-card kit part** that lays itself out inside `ZONE` and
  shrinks the logo to fit — replaces this reel's and TeamDay's copied `EndBeat` (and `CtaBeat`'s
  URL variant), retires `lift` and the `logoSize` knob added here; (b) `video/assets.json` may
  name an exact rendition, and media records carry pixel sizes, so a sized cut can't silently land
  full-frame; (c) `PhotoCard`'s border / stamp size / entry as theme tokens, its paper colour from
  the levyam `C`, not the testimonial-era theme.
- 2026-11-02 — Gate 2 approved by the owner on the second pass (reviewer: all four PASS; borderlines
  left as is — the kit's heartZoom title ghost at frame 280, the three-line Arabic end-card title
  for the Arabic sign-off). Not rendered; posting waits on `offsite-03/04` consent `social` and the
  owner's Arabic sign-off.
- 2026-11-02 — Gate 2 (first pass): the reviewer passed all four after one fix (the Arabic end
  card: a smaller logo, `SignOff` gained `logoSize`); the owner swapped the plenary card
  (`offsite-02`) for `work-05` with a new caption — re-review follows.
- 2026-11-02 — brief written with the owner (type, event, audience + ask, 12 s 9:16, HE + AR, hooks question + footage, postcards on cream, shot list approved as proposed; consent asked by the owner); Gate 1: approved as written by the owner; run in the same session
