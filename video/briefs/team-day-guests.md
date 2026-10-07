# Brief — A team day by the sea, in our guests' words (`team-day-guests`)

*Written 2026-10-07 with the `new-video` skill · type: testimonial over real event footage · status:
draft → approved (Gate 1 …) → built → reviewed (Gate 2) → rendered → posted*

> This file is the complete prompt. A build session reads **`video/GUIDELINES.md`
> first**, then follows this brief shot by shot. Nothing on screen that is not written here —
> except the five quotes, which live in the private file below and nowhere in the repo.

## Spec

- **Composition ids:** `team-day-guests-he-footage`, `team-day-guests-he-question`, `team-day-guests-ar-footage`, `team-day-guests-ar-question` (one `<Folder name="TeamDayGuests">`)
- **Size / fps / length:** 1080 × 1920 · 30 fps · 20 s = 600 frames · Reels / Stories only (no 4:5 feed re-layout)
- **Languages:** HE and AR, both built now (a native reader signs the Arabic off before posting)
- **Audio:** none
- **Rules:** guidelines §3 (safe zone: `ZONE`, `<SafeZone />` on in Studio), §4 (type, RTL), §5 (motion), §6 (compose from the kit) — as read on 2026-10-07; the guidelines win where this brief and they diverge
- **Facts:** only the lines cited below; nothing invented; no prices; no names — not the client company, not the people in the footage, not the reviewers
- **Kit dependency:** `ZoneBlock`, `SignOff`, `KEN_BURNS_MAX` and `hero()` arrive with PR #120 (moments-by-the-sea). Build on top of it once it merges (or on its branch).

## Goal

Show HR and team leads a real team day at Lev Yam — the long table under the pergola facing the
sea, the group on the sand — and let five guests' public Google reviews say what the place gives
people. **The one ask:** "כתבו לנו בוואטסאפ" / "اكتبوا لنا على واتساب" → WhatsApp `972506669138`.

## The event (private)

A team workshop held at the venue in June 2026 (the exact date stays out of the repo — with "a
team workshop" it could identify the client). The group agreed to the publication of the
photos (owner, 2026-10-07). **The client is never named** — not on screen, not in this brief,
not in the copy files, not in a commit message (`FACTS.md` § מה לא נכתב אף פעם; guidelines §1.1).
The date is not shown on screen.

## The quotes (private) — honest framing

None of the 105 Google reviews (scraped 2026-10-07) was written by this group. The quotes are
therefore framed as **"מה אומרים האורחים" / "شو بيحكوا ضيوفنا"** over the event footage, never as
the team's words (owner, 2026-10-07). Five 5★ reviews chosen by the owner for their fit with a
team day (disconnecting, gathering, the sea); excluded: any review naming staff, mentioning a
price, or reading as a machine translation.

- **File:** `video/public/private/team-day/quotes.json` (gitignored) —
  `{ "quotes": [{ "label": { "he": "אורחת", "ar": "ضيفة" }, "he": "…", "ar": "…" }, …] }`,
  exactly 5 entries, in slot order Q1–Q5. Labels are neutral ("אורח" / "אורחת"), never a name.
- **Trimming:** each quote is a verbatim excerpt; a cut is marked "…"; no word is changed or added.
- **Arabic:** a translation of the Hebrew original, marked `[ar-draft]` in the file until the
  native reader signs it off, and the beat carries the line "مترجم من العبرية".
- **Loader:** a `calculateMetadata` like `loadReviews` in `video/src/data.ts`, with its own file
  and slot count (5) — the testimonial's 3-slot loader is not changed. Studio without the file shows
  `[חסר]` placeholders; a render without it fails.

| Slot | Theme (what the quote says, for the build — the text itself is in the file) | Length on screen |
|---|---|---|
| Q1 | calm, the sea — "for people who want to disconnect and recharge" | ≤ 10 words |
| Q2 | a place that invites special gatherings, relaxed, on the beach | ≤ 9 words |
| Q3 | a place that lets you stop and reconnect with yourself | ≤ 7 words |
| Q4 | a rare mix of sea, food, culture and ease | ≤ 7 words |
| Q5 | whoever wants to disconnect should come sit here | ≤ 8 words |

## Facts used (source · line)

| On screen | Source |
|---|---|
| "יום צוות" / team day | `FACTS.md` § שירותים: "אירועים עסקיים — ימי גיבוש, ימי אסטרטגיה" |
| "על קו המים" | `FACTS.md` § זהות: "מרחב … על קו המים" |
| "כפר הדייגים · ג'סר א-זרקא" | `FACTS.md` § מיקום והגעה |
| "לב ים" / "ليف يام" | `FACTS.md` § זהות |
| WhatsApp "050-666-9138" | `FACTS.md` § זהות: `972506669138` (shown in local form) |
| ★★★★★ beside each quote | each quote is a 5★ Google review (scrape 2026-10-07) |
| the five quotes | the venue's public Google reviews, verbatim excerpts, private file |

Missing: none.

## Assets (by path)

All derivatives are made from the gitignored `media/` intake into the **gitignored**
`video/public/private/team-day/` (owner, 2026-10-07: the footage shows a client's team, and the
repo is public). Stills: sRGB, EXIF stripped, 2560 px wide. Clips: H.264, 30 fps, muted, from the
150 fps HEVC live clips.

| Shot | File | Source in `media/` | Why this one · crop / focus |
|---|---|---|---|
| 1A, 1B | `private/team-day/table-sea.mp4` | `Lev Yam - Event - 4 of 41.mov` (2.83 s) | the long table, the sea behind the palms · landscape → 9:16 crops sideways only; `Clip` `x={45}` keeps the standing speaker and the sea; `playbackRate` 0.94 to fill 90 frames |
| 2 (Q1) | `private/team-day/table-wide.mp4` | `Lev Yam - Event - 3 of 41.mov` (2.53 s) | the table from the side, the beach beyond · `Clip` `x={60}`; `playbackRate` 0.9 to fill 84 frames |
| 3 (Q2) | `private/team-day/table-03.jpg` | `Lev Yam - Event - 3 of 41.HEIC` | still of the same angle, crop toward the sea (`"80% 50%"`) — different framing from shot 2 |
| 4 (Q3) | `private/team-day/table-04.jpg` | `Lev Yam - Event - 4 of 41.HEIC` | crop on the palms and the sea (`"15% 50%"`) |
| 5 (Q4) | `private/team-day/table-04.jpg` | same | crop on the far end of the table (`"85% 50%"`) |
| 6 (Q5) | `private/team-day/table-03.jpg` | same | crop on the near end of the table (`"20% 50%"`) |
| 7 | `private/team-day/group.jpg` | `Lev Yam - Event - 5 of 41.HEIC` | the group on the sand, the two lighthouses behind · a horizontal pan across the group (translate, ≤ `KEN_BURNS_MAX`) |
| 8 | `site/logo.png` (from `img/logo/logo-mono-nobg.png`) on cream `C.cream` | — | end card |

## Shots

Frame counts at 30 fps; transitions are 15 frames and shorten the timeline; overlays do not.
Total: 90 + 84 + 84 + 60 + 60 + 60 + 75 + 102 − 15 (heartZoom) = **600**.

| # | Seconds (frames) | Beat | HE copy (exact) | AR copy (exact) | Asset | Kit motion / transition in |
|---|---|---|---|---|---|---|
| 1A | 0–3.0 (90) | HOOK **footage** | frames 0–14: no text · from 15: "יום צוות על קו המים" | "يوم للفريق على شط البحر" [ar-draft] | `table-sea.mp4` | the clip moves at frame 0 (scroll-stop); `Words` headline from frame 15, `Accent` under it; `Scrim` bottom |
| 1B | 0–3.0 (90) | HOOK **question** | "מחפשים מקום ליום צוות?" | "بتدوروا على مكان ليوم الفريق؟" [ar-draft] | `table-sea.mp4` | same clip; `Words` from frame 0 (first word in at frame 0) |
| 2 | 3.0–5.8 (84) | Q1 | heading `Pill` "מה אומרים האורחים" · ★★★★★ · Q1 · "— {label}" | `Pill` "شو بيحكوا ضيوفنا" [ar-draft] · ★★★★★ · Q1 · "— {label}" · "مترجم من العبرية" | `table-wide.mp4` | hard cut; the quote block `Rise`s as one (no per-word stagger — reading time); `Scrim` bottom |
| 3 | 5.8–8.6 (84) | Q2 | same layout, Q2 | same, Q2 | `table-03.jpg` | hard cut; `KenBurns` 1.00 → 1.06; the `Pill` stays put across shots 2–6 (same position, no re-entry) |
| 4 | 8.6–10.6 (60) | Q3 | same, Q3 | same, Q3 | `table-04.jpg` | hard cut; `KenBurns` |
| 5 | 10.6–12.6 (60) | Q4 | same, Q4 | same, Q4 | `table-04.jpg` (other crop) | hard cut; `KenBurns` |
| 6 | 12.6–14.6 (60) | Q5 | same, Q5 | same, Q5 | `table-03.jpg` (other crop) | hard cut; `KenBurns` |
| 7 | 14.6–17.1 (75) | THE GROUP | "כפר הדייגים · ג'סר א-זרקא" | "قرية الصيادين · جسر الزرقاء" [ar-draft] | `group.jpg` | hard cut; horizontal pan; `ZoneBlock` body line |
| 8 | 16.6–20.0 (102, 87 alone) | END CARD | "רוצים יום כזה לצוות?" / "כתבו לנו בוואטסאפ" / "050-666-9138" | "بدكم يوم متل هاد لفريقكم؟" / "اكتبوا لنا على واتساب" / "050-666-9138" [ar-draft] | `site/logo.png` on cream | `heartZoom` in (15 f); `SignOff` + the ask; number in `Bidi`; **the last 45 frames hold still** |

Everything after shot 1 is shared by both hooks. Quotes and captions sit in the `ZONE` text box
(x 120–853, y 288–1248), never in the bottom 35 %. Quote type is body size (HE 50 / AR 46), never
under 44 px; the label and "مترجم من العبرية" at ≥ 36 px.

## Acceptance (this reel's additions to `review.md`'s standard checks)

- [ ] Every fact on screen matches the Facts table above
- [ ] No client name, person's name or reviewer's name anywhere — screen, copy files, brief, commit
- [ ] No quote text and no event footage in the repo (`git status` shows nothing under `video/public/private/`)
- [ ] Each quote matches its Google review verbatim, cuts marked "…"
- [ ] The heading says "guests", never "the team"; the Arabic quotes carry "مترجم من العبرية"
- [ ] Hook 1A has **no text** on frames 0–14 and a moving image on frame 0
- [ ] Each quote is readable in its beat (≤ 10 words for 84 f, ≤ 8 for 60 f)
- [ ] The upscaled clips (1308 → 1920 tall) are not visibly soft — flag at Gate 2
- [ ] The end card holds still for its last 45 frames
- [ ] Arabic signed off by a native reader before posting

## Render matrix

| Composition | File |
|---|---|
| `team-day-guests-he-footage` | `out/team-day-guests-he-footage.mp4` + `out/team-day-guests-he-cover.png` |
| `team-day-guests-he-question` | `out/team-day-guests-he-question.mp4` |
| `team-day-guests-ar-footage` | `out/team-day-guests-ar-footage.mp4` + `out/team-day-guests-ar-cover.png` |
| `team-day-guests-ar-question` | `out/team-day-guests-ar-question.mp4` |

## Out of scope for this reel

- The client's name or logo, the event's date, any person's name
- The Google rating figure (5.0 · 105) — not in `FACTS.md`
- Sound, English, a 4:5 feed version, a second CTA (no site URL), any price
- The other days in the `media/` "Event" set (wellness morning, celebration, family day)

## Log

- 2026-10-07 — brief written; reviews scraped (105, none from the group → "guests" framing); Gate 1: approved by the owner.
- 2026-10-07 — built on top of PR #120's kit. Kit additions: `Clip` (a landscape clip cropped sideways — `<Video>` ignores object-position), stars from `icons.tsx` `StarRow` (SVG; the Arabic font has no ★), `KenBurns` `cropTo` (a pan), `SignOff` `fitZone` + `stagger` (opt-in, so the shipped end cards are unchanged). Group line moved to the sky (it covered faces). Reviewer subagent, two rounds: fixed the AR end card leaving ZONE, AR Q1 trimmed to 10 words (dropped "شوي", "طاقتهم"), "راحة بال" joined, hook B's second word mid-rise at frame 0, end-card hold proven (555 ≡ 599). All PASS; open for Gate 2: a supermarket-brand bag in the table footage, the Hebrew-only wordmark on the AR end card, the hook clip's upscale softness.
- 2026-10-07 — Gate 2: approved by the owner. The supermarket bag and a branded tote are **blurred in the private derivatives** (owner's call; the wide clip's blur tracks the camera move — not reproducible from the repo, since the footage is private). The AR end card keeps the logo's Hebrew wordmark only (owner's call).
- 2026-10-07 — pre-commit gate: `/simplify` (shared `loadPrivate` for the private files, `MediaBeat` shared with moments — its stills pixel-identical, `StarRow` reused, `caption()` role, `KenBurns` `cropTo`); `/code-review` high: no correctness findings (comment drift fixed); `/security-review`: the exact event date removed from this brief; `/verify` = the review stills, re-rendered after the refactor, end-card hold re-proven.
