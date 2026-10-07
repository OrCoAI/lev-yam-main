# Brief — Moments by the sea (`moments-by-the-sea`)

*Written 2026-10-06 with the `new-video` skill · type: ambient venue showcase (three moments of a
day at the venue) · status: draft → approved (Gate 1 2026-10-06) → built → reviewed (Gate 2 2026-10-06) → rendered
→ posted*

> This file is the complete prompt. A build session reads **`video/GUIDELINES.md`
> first**, then follows this brief shot by shot. Nothing on screen that is not written here.

> **Blocked for posting on a rule change.** The end card carries **no call to action** (owner,
> 2026-10-06). That contradicts `video/GUIDELINES.md` §7 ("One ask. One CTA per reel, in words, on
> an end card held ≥ 1.5 s"). The owner chose to **amend the rule** — a separate Tier-A PR to
> `video/GUIDELINES.md` §7 (+ an ADR line under ADR 0064), in its own session. The reel may be
> built and reviewed now; it is **not posted until that PR is merged**. The reviewer reports the
> missing ask as a known exception, not a FAIL.

## Spec

- **Composition ids:** `moments-by-the-sea-he-footage`, `moments-by-the-sea-he-name`, `moments-by-the-sea-he-place`, `moments-by-the-sea-ar-footage`, `moments-by-the-sea-ar-name`, `moments-by-the-sea-ar-place` (one `<Folder name="MomentsBySea">`)
- **Size / fps / length:** 1080 × 1920 · 30 fps · 8 s = 240 frames · Instagram **Story** only (no 4:5 feed re-layout)
- **Languages:** HE and AR — built in that order (HE first); AR in the same brief, marked `[ar-draft]` until a native reader signs it off; nothing is posted before both exist
- **Audio:** none
- **Rules:** guidelines §3 (safe zone: `ZONE`, `<SafeZone />` on in Studio), §4 (type, RTL), §5 (motion), §6 (compose from the kit) — as read on 2026-10-06; the guidelines win where this brief and they diverge (except the §7 ask, above)
- **Facts:** only the lines cited below; nothing invented; no prices; no names (the people in the photos are never named)

## Goal

Show, in eight silent seconds, what a day at Lev Yam feels like — working facing the sea, local
food at the table, the sunset from the pergola — for **everyone scrolling Instagram Stories**.
**The ask:** none — the end card is a sign-off (name + place). The owner may add Instagram's own
link sticker at posting time; it is not part of the render.

## Facts used (source · line)

| On screen | Source |
|---|---|
| "לעבוד מול הים" / work facing the sea | `FACTS.md` § המתחם: "אינטרנט מהיר", "פינות ישיבה מגוונות"; § שירותים, יום ראשון לקהילה: "לעבוד, לשוחח ולהתחבר" |
| "לב ים" / "ليف يام" | `FACTS.md` § זהות: השם |
| "כפר הדייגים · ג'סר א-זרקא" | `FACTS.md` § מיקום והגעה: "כפר הדייגים, ג'סר א-זרקא" |
| "אוכל מקומי, מהים לשולחן" | `FACTS.md` § מטבח: "מהים לשולחן (sea-to-table) — אוכל מקומי טרי" |
| "שקיעה מול הים" (pergola) | `FACTS.md` § המתחם: "פרגולה מול הים"; the sunset is what the photo shows (gallery/16) |

Missing: none. No seasonal fact (no hours, no days).

## Assets (by path)

| Shot | File | Why this one · crop / focus |
|---|---|---|
| 1 | `site/work-window.jpg` (from `img/gallery/12.jpg`, 1205 × 1600) — **new line in `scripts/sync-assets.mjs`** | laptop + iced coffee, the sea through the old window · 3:4 source, so in 9:16 it only crops sideways; `crop` y sets where the push-in closes in |
| 2 | `site/weekend-table.jpg` (from `img/services/weekend.jpg`, 900 × 1200 — already mapped) | the laid table by the sea · `objectPosition: "50% 70%"` (a 3:4 source only crops sideways in 9:16, so the frame shows the two diners and the table — the y position has no effect); upscaled ~1.6× — check sharpness at Gate 2, keep Ken Burns ≤ 1.05 |
| 3 | `site/sunset-pair.jpg` (from `img/gallery/16.jpg`, 1200 × 1600 — already mapped) | the sun low over the sea from the pergola · 3:4 source, crops sideways only; the push-in closes in toward the sky (`crop` y 30%) |
| 4 | `site/logo.png` (from `img/logo/logo-mono-nobg.png`) on cream `C.cream` | sign-off |

## Shots

Frame counts at 30 fps; transitions are 15 frames and shorten the timeline; overlays do not.
Total: 66 + 54 + 60 + 75 − 15 (heartZoom) = **240**.

| # | Seconds (frames) | Beat | HE copy (exact) | AR copy (exact) | Asset | Kit motion / transition in |
|---|---|---|---|---|---|---|
| 1A | 0–2.2 (66) | HOOK **footage** | frames 0–14: no text · from 15: "לעבוד מול הים" | "نشتغل قبال البحر" [ar-draft] | `site/work-window.jpg` | `KenBurns` 1.00 → 1.06 from frame 0 (motion at frame 0 = the scroll-stop); `Words` headline from frame 15, `Accent` under it; `Scrim` bottom (captions sit at the zone's bottom edge) |
| 1B | 0–2.2 (66) | HOOK **name** | "לב ים" (display, ≥ 160 px) | "ليف يام" [ar-draft] | `site/work-window.jpg` | same `KenBurns`; `Words` from frame 0 (first word in at frame 0, per §7); text only — **no logo** (§6/§7) |
| 1C | 0–2.2 (66) | HOOK **place** | "כפר הדייגים" / small line "ג'סר א-זרקא" | "قرية الصيادين" / "جسر الزرقاء" [ar-draft] | `site/work-window.jpg` | same `KenBurns`; `ZoneBlock` headline + body, `Words` from frame 0 |
| 2 | 2.2–4.0 (54) | FOOD | "אוכל מקומי, מהים לשולחן" | "أكل محلي، من البحر للسفرة" [ar-draft] | `site/weekend-table.jpg` | hard cut in; `KenBurns` 1.00 → 1.05; `Words` from frame 0, stagger 5; `Scrim` bottom |
| 3 | 4.0–6.0 (60) | SUNSET | "ובערב, שקיעה מול הים" | "وبالمسا، غروب قبال البحر" [ar-draft] | `site/sunset-pair.jpg` | hard cut in; `KenBurns` 1.00 → 1.06; `Words` from frame 0, stagger 5; `SunDot` beside the line; `Scrim` bottom |
| 4 | 5.5–8.0 (75, 60 alone) | END CARD (sign-off, no ask) | "לב ים" / "כפר הדייגים · ג'סר א-זרקא" | "ليف يام" / "قرية الصيادين · جسر الزرقاء" [ar-draft] | `site/logo.png` on cream | `heartZoom` in (15 f); `SignOff` (logo + name) + place line, lifted 60 px; all settled by frame 193; **frames 195–239 hold still** (≥ 1.5 s) |

Everything after shot 1 is shared by all three hooks. Captions sit in the `ZONE` text box
(x 120–853, y 288–1248), never in the bottom 35 %.

## Acceptance (this reel's additions to `review.md`'s standard checks)

- [ ] Every fact on screen matches the Facts table above
- [ ] Hook 1A has **no text** on frames 0–14 and a moving image on frame 0
- [ ] Hook 1B shows the name as text only — no logo before the end card
- [ ] The table shot (upscaled) is not visibly soft at 1080 wide; if it is, flag it at Gate 2
- [ ] Nobody in a photo is named anywhere (screen, copy file, brief)
- [ ] The end card holds still for its last 45 frames; the missing ask is reported as the known §7 exception (until the amendment merges)
- [ ] Arabic signed off by a native reader before posting

## Render matrix

| Composition | File |
|---|---|
| `moments-by-the-sea-he-footage` | `out/moments-by-the-sea-he-footage.mp4` + `out/moments-by-the-sea-he-cover.png` |
| `moments-by-the-sea-he-name` | `out/moments-by-the-sea-he-name.mp4` |
| `moments-by-the-sea-he-place` | `out/moments-by-the-sea-he-place.mp4` |
| `moments-by-the-sea-ar-footage` | `out/moments-by-the-sea-ar-footage.mp4` + `out/moments-by-the-sea-ar-cover.png` |
| `moments-by-the-sea-ar-name` | `out/moments-by-the-sea-ar-name.mp4` |
| `moments-by-the-sea-ar-place` | `out/moments-by-the-sea-ar-place.mp4` |

## Out of scope for this reel

- A call to action, a WhatsApp number or a URL on screen (owner's choice; see the §7 block above)
- The §7 amendment itself (its own Tier-A PR)
- The 4:5 feed re-layout, Reels distribution, English, sound, prices
- Team days / private events framing (the business promo is a different reel)
- Instagram's link sticker — added by the owner in the app, not rendered

## Log

- 2026-10-06 — brief written from the owner's answers: three moments (gallery/12, services/weekend, gallery/16), Instagram Story, everyone, 8 s, no ask (→ amend §7), three hooks (footage / name / place), HE first then AR. Gate 1: approved by the owner as written, 2026-10-06; run in the same session.
- 2026-10-06 — built (kit: `KenBurns` `to` cap, `ZoneBlock` on `ZONE` + 12 px inset, `TYPE.*.hero`; asset map: `work-window.jpg`). Reviewer subagent ×2: end-card sub-line in the bottom band, AR "من / البحر" break, 1 px descender, AR hero < 160 → all fixed; end-card hold proved (0195 = 0239). Gate 2: owner approved the stills as is (food shot, logo + text name on the end card kept). Not yet rendered; not postable before the §7 amendment and the Arabic sign-off.
- 2026-10-06 — Gate 3: the owner rendered from Studio — HE footage-first and the Arabic versions (Arabic still `[ar-draft]`). Not posted: waits on the §7 amendment and the native reader's Arabic sign-off; the plan's publish log gets its line when posted.
