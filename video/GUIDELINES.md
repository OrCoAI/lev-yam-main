# Video guidelines — Lev Yam reels with Remotion

*The one rule file for every video this repo makes. Read in full before a brief, a build or a
review. Changing it is a Tier-A PR (the leash, ADR 0036 — `scripts/check-tier.mjs` names this
file); the weekly `video-guidelines-refresh` job proposes amendments as a PR the owner merges
(ADR 0064). It lives here, not under `.claude/`, because `.claude/` is a path Claude Code never
lets a non-interactive agent write to. Section 1 is the owner's — no job edits it.*

| | |
|---|---|
| **Remotion** | pinned in `video/package.json` (`npx remotion versions`); every `remotion` / `@remotion/*` package at that one exact version |
| **Skills** | official Remotion Agent Skills `4.0.532` (`remotion-dev/skills`, installed per machine at `~/.agents/skills/remotion-*`, `remotion-markup` folder hash `e671b318`) |
| **Platforms** | Meta only this quarter: Reels, Stories, feed 4:5 (owner, 2026-10-06) |
| **Audio** | none in v1 (owner, 2026-10-06) |
| **License** | Remotion free license — organisations of up to 3 people, client work included (owner's count 2026-10-06: ≤ 3); re-read weekly |
| **Research base** | the owner's research document (2026-10-06) + the installed skills + the repo's rules; the last refresh is the newest Changelog entry (newest first) |

## 1. Rules of the house (the owner's — never edited by the weekly job)

1. **The repo is public.** No customer or reviewer names (a Google review appears with a neutral
   label such as "אורחת"), no staff or resident names, no phone numbers beyond the venue's
   WhatsApp, never the owner's signature. **Review texts are not committed either** (owner,
   2026-10-06): they live in the gitignored `video/public/private/reviews.json`, read at render
   time by `video/src/data.ts`; the repo holds `[חסר]` placeholders (Studio shows them, a render
   without the file fails). Real names, if ever wanted
   on screen, go the same way and are never committed.
2. **Facts come from `FACTS.md`** or the live `/happening/` page the reel promotes, read that day
   and cited in the brief. A seasonal fact (opening hours) is cited with the date `FACTS.md`
   gives it; the owner re-confirms it in Gate 1 and the reel is not posted once its season has
   changed. A missing fact is `[חסר: …]` / `[مفقود: …]` in the brief, never a
   guess — and never an invented URL, date, phone number or review. **No prices anywhere**:
   cost appears only as "free" / "ببلاش" or "by WhatsApp".
3. **Hebrew and Levantine Arabic, both, before anything is posted** (ARCHITECTURE invariant 5).
   Arabic copy may be machine-drafted and must carry `[ar-draft]` until a native reader has
   signed it off (the ADR 0055 rule applied to video). RTL correct in both.
4. **The venue's own pictures only:** `img/` (synced into `video/public/site/`) and the
   gitignored `media/` intake. No stock, no AI-generated footage of the place.
5. **Never deployed, never auto-merged.** `video/` is not on the assemble allowlist; the weekly
   refresh opens a PR, a human merges. The skill never renders the final MP4, commits, pushes or
   posts on its own.
6. **No audio without a license line.** v1 reels are silent-safe (burned-in text carries the
   message). An audio file enters `video/public/` only with its license in
   `video/public/audio/LICENSES.md`.
7. **Three human gates:** storyboard (Gate 1) → stills (Gate 2) → the MP4 on a phone (Gate 3).
   Nothing is posted before Gate 3.
8. **License watch:** the free Remotion license holds at ≤ 3 people (client work included). If the
   count that applies to the videos changes, a Company License is a cost line before the next
   posted reel.

## 2. Formats and platforms (Meta)

| Use | Size | fps | Length | Notes |
|---|---|---|---|---|
| Reels / Stories (primary) | 1080 × 1920 (9:16) | 30 | cold reach 6–15 s; consideration 15–30 s; ambient loop ≤ 15 s | the existing reels are 20 s and 12 s |
| Feed | 1080 × 1350 (4:5) | 30 | same | a **re-layout** of the 9:16 composition, never a letterbox |
| WhatsApp status | the 9:16 file | | | specs unverified — check the upload once |
| Cover still | 1080 × 1920 PNG | | | headline inside the centre 4:5 crop (y 285–1635), rendered from the composition's best frame |

Why these lengths: Meta reports that up to 47 % of a video campaign's value is delivered in the
first three seconds and up to 74 % in the first ten (Facebook for Business, "Capture Attention
with Updated Features for Video Ads"); Reels allow up to 90 s but short wins for cold reach
(2026 ad-ops guides, consistent with each other). TikTok and YouTube Shorts are out of scope this
quarter; when they come, their profiles join §3 and the `<SafeZone>` guide.

## 3. Safe zones (use the strictest that applies)

Meta's own guidance, not the popular prompts' looser numbers (150 / 170 px), which put text under
the Reels caption and the like/comment/share rail.

| Platform | Top | Bottom | Sides | Right rail | Source |
|---|---|---|---|---|---|
| Reels / Stories (Meta ads) | 14 % = **269 px** | 35 % = **672 px** | 6 % = **65 px** | the rightmost ~21 % over the lower 40 % | Meta Ads Guide (official) — same box for Stories per the Ads Manager guardrail |
| Reels ads with a disclaimer | — | 40 % | — | — | Meta Business Help Center |

- **Master text zone** on 1080 × 1920: **x 120–853, y 288–1248** (853 is where the rail starts,
  so the zone never overlaps a band). Captions and running text sit
  mid-frame, y ≈ 1000–1250, never at the classic bottom position.
- **The end card** holds **≥ 1.5 s** and says the action in words ("כל הפרטים באתר",
  "اكتبوا لنا على واتساب") because the platform's own button covers the bottom.
- In code: `META` and `ZONE` in `video/src/levyam/theme.ts`; `<SafeZone />` draws the bands and
  the dashed text zone **in Studio only** (never in a render); the reviewer (`review.md`) fails a
  still whose key text leaves the zone.
- The two reels built on 2026-10-05 (`WeekendReel-*`, `LevYamTestimonial`) use the older
  `SAFE` / `TEXT` tokens (150 / 170 / 60). They stay as built until their re-layout follow-up; the
  reviewer flags them until then. New work uses `ZONE`.

## 4. Typography and right-to-left text

- **Fonts** load through `@remotion/google-fonts` with explicit `weights` **and** `subsets`:
  `hebrew` + `latin` for Assistant (display) and Heebo (body) — the site's own pairing from
  `css/styles.css` — and `arabic` + `latin` for Noto Sans Arabic in both roles (the site's Arabic
  stack is Apple system fonts a render cannot load). A missing subset silently bakes a fallback
  font into the video. The site's self-hosted `fonts/` subsets have no Arabic, so video does not
  reuse them. `loadFont()` blocks the render until the font is ready.
- **Minimum sizes at 1080 wide** (the official layout rule's 84 / 44 and the research's floor,
  whichever is stricter): headline **≥ 84 px**, body **≥ 44 px**, nothing under **36 px**;
  Arabic line-height ≥ 1.4, Hebrew ≥ 1.12 for display. The kit's `TYPE` tokens encode this
  (HE 100 / 50 / 40, AR 88 / 46 / 40).
- **Direction:** `dir="rtl"` and `lang` on the composition root; digits, times, ranges and Latin
  (URLs, "Google") inside `<bdi dir="ltr">` — the kit's `Bidi` part does it for a whole line.
  Mirror layout, directional icons, arrows and slide directions for RTL; **never** mirror logos,
  photos, numbers or media.
- **Arabic joins.** Animate **per word, never per letter** (inline-block letters break contextual
  shaping; the kit's `Words` splits on spaces only). **No `letter-spacing`**, **no
  `-webkit-text-stroke`** on Arabic — both cut joined glyphs apart. A phrase that must not break
  (a name, "لب يام") is joined with ` `.
- **Hebrew** letters do not join, so per-letter is allowed; split by grapheme
  (`Intl.Segmenter`) so niqqud stays attached.
- **Copy is written natively per language,** never machine-translated for marketing; Arabic
  needs the native reader (rule 1.3). Arabic runs longer: give it its own beat durations if a
  scene is tight, do not squeeze the type.

## 5. Motion

- **Everything is a function of `useCurrentFrame()`** through `interpolate()` / `spring()`. No CSS
  `transition` / `animation`, no Tailwind animation classes, no wall-clock libraries (GSAP's own
  clock yields black frames), **no `Math.random()`** (use `random(seed)`), no `translateZ(0)`
  "for performance" (it rasterises text).
- **Easing tokens, not ad-hoc curves:** `OUT`, `IN`, `IN_OUT`, `SWEEP`, `BACK` in
  `video/src/levyam/transitions/timing.ts`; `spring({ damping: 200 })` for a push with no
  bounce; **no bouncy springs on type**; `output: 'perceptual-scale'` on scale animations;
  `extrapolateLeft/Right: 'clamp'` on every interpolation (the kit's `clamp`).
- **Cuts and brand transitions, not fades.** `fade()` keeps the outgoing scene visible, so two
  headlines overlap mid-transition. Between text beats use a hard cut (`<Series>`) or one of the
  five brand transitions (`sunIris`, `postcard`, `houseWindow`, `waveWash`, `heartZoom`); a
  `TransitionSeries.Overlay` (the testimonial's `BandSweep`, a light leak) does not shorten the
  timeline, a `Transition` does — account for it in `durationInFrames`.
- **`premountFor={fps}`** on every timed item that supports it: media, sequences,
  `TransitionSeries.Sequence` / `.Overlay`, interactive components.
- **Studio-editable markup:** inline `interpolate()` in the `style` prop; `scale` / `translate` /
  `rotate` properties, not `transform` strings; a `name` on every editable node; inline
  `defaultProps` and `durationInFrames` on each `<Composition>` / sequence; each scene its own
  component and connected composition; loops only for instances meant to be edited as one.
- **Ken Burns ≤ 1.10 scale** over a beat; a transition is 0.5 s (15 frames); words enter 16
  frames each with an 8–10-frame stagger (`ENTER`, `Words`).

## 6. Structure and the kit

- **One composition per creative, parameterised by a zod schema;** every word on screen comes
  from `video/src/copy/<lang>.ts`, so a new event is a new copy entry, not new markup. The
  `hook` prop is an enum with **at least two variants** per creative (§7); the end card is a
  component taking `cta` and `lang`.
- **Variants are compositions:** `<Composition id="WeekendReel-he-hookB" … defaultProps={{ …he, hook: "free" }} />`
  — one JSX node per (language × hook), grouped in a `<Folder>`; the render matrix in the brief
  lists them. Dynamic duration (a card per event) goes through `calculateMetadata`.
- **The brand kit lives in `video/src/levyam/`:** `theme.ts` (colours `C` from `css/styles.css`,
  `TYPE`, safe zones), `parts.tsx` (`Words`, `Rise`, `Bidi`, `KenBurns`, `Scrim`, `Accent`,
  `SunDot`, `TextBlock`, `Pill`), `transitions/`, `SafeZone.tsx`; `video/src/brand.tsx` carries
  the testimonial-era parts (`Zigzag`, `StampFrame`, `Wordmark`, `PalmSun`, `Grain`, `BandSweep`).
  **Compose from the kit; extend the kit rather than hand-roll** a panel, caption or easing in a
  scene — a scene with its own font size or gap is drift (Roboto Studio measured ~19 % duplicated
  UI and sizes 14–19 px for one role when scenes were prompted from scratch).
- **The brand:** cream `#fff7ea`, ink `#1a3340`, orange `#f49834`, blue `#2c92bf`; the wave
  divider, the zigzag stamp edge, the sun / palm / house / heart icons, the two-tone wordmark. The
  logo appears on the end card, not in the first three seconds.

## 7. Hooks and content

- **The first three seconds decide it.** Frame 0 is a scroll-stop frame: footage up, the first
  word in, the second mid-rise. Motion and the subject first — **no logo intro**, no brand
  animation before the end card.
- **At least two hook variants per creative** (the opening ~3 s swappable by the `hook` prop,
  everything after the first cut identical), so a tired creative gets a fresh hook without a
  rebuild and the two can be read against each other.
- **Silent-safe:** burned-in text carries the whole message; a reel must work with sound off
  (v1 has no sound at all).
- **One ask.** One CTA per reel, in words, on an end card held ≥ 1.5 s; the WhatsApp number
  or the page URL comes from `FACTS.md` / the copy file, never typed into markup.
- **Loops:** an ambient reel's last frame meets its first (SunsetDream's warm flash) so the
  replay is seamless.
- **Cover still:** render one per posted reel (`npm run still -- <id> --frame=<n> <out.png>`),
  headline inside the centre 4:5 crop.
- **Positioning** follows the Q4 mandate: private and business events, the venue and what it gives
  people (ADR 0046); community items use the "יוזמות" / "مبادرات" naming (ADR 0058).

## 8. Assets

- `video/public/site/` is **generated** from `img/` by `npm run assets`
  (`video/scripts/sync-assets.mjs` is the map) and gitignored. The site's photos, icons and the
  hero clip are never copied into git a second time.
- `video/public/brand/` (recoloured icons) and `video/public/photos/` (photos that exist nowhere
  else) are committed, optimised, small. Raw clips and originals go to the gitignored `media/`
  intake (as for stories) and only derivatives ship.
- Reference files with `staticFile("site/…")`; a remote URL is never used for a brand asset.
- Photos: `<Img>` / `<CanvasImage>` with `objectFit: "cover"` and a stated `objectPosition`; a
  small source (the 708 × 387 aerial) is a card, never stretched full-frame.
- Video: `<Video>` from `@remotion/media`, `muted` in v1, `trimBefore` / `durationInFrames` for
  the cut, `premountFor={fps}`.

## 9. Workflow — the three gates

Brief → **Gate 1** (the owner approves the storyboard, one line per shot) → build in Studio →
review stills → **Gate 2** (the owner sees the stills) → render on request → **Gate 3** (the MP4
on a phone) → the owner posts by hand, both languages, and logs the reel in the plan's publish
log (date, slug, language, hook, platform; the hook rate from Meta Insights when read). The
procedure — commands, frames, the reviewer as a subagent — is `SKILL.md` §4–6 and `review.md`;
this file carries the rules only.

## 10. Rendering

- `npm run render -- <id> <out.mp4>` — H.264 MP4 by default; `npm run still -- <id> --frame=<n>
  <out.png>` for one frame; both sync `public/site/` first (a bare `npx remotion …` on a fresh
  clone renders with the site assets missing). First render downloads Chrome Headless Shell
  (~100 MB, once).
- `video/remotion.config.ts`: rspack bundling, JPEG frames, `setChromiumOpenGlRenderer("angle")`
  — required for `@remotion/effects` (the light leaks) during renders.
- Output naming: `out/<slug>-<lang>-<hook>.mp4`, `out/<slug>-<lang>-cover.png`; `out/` is
  gitignored. Local renders only this quarter (no Lambda, no Player).
- A render is deterministic: the same frame renders the same twice (hence §5's `random(seed)`).

## 11. Versions and upgrades

- **All `remotion` and `@remotion/*` packages share one exact version.** Add a package with
  `npx remotion add <pkg>` (it picks the right version); upgrade with `npx remotion upgrade`
  (packages, lockfile, and project-local skills); `npx remotion versions` to check. Never bump one
  Remotion package alone — dependabot's `/video` entry groups them for that reason.
- **The agent skills are per machine:** `npx skills update remotion-best-practices
  remotion-captions remotion-create remotion-docs remotion-interactivity remotion-maps
  remotion-markup remotion-multimedia remotion-render remotion-saas remotion-studio
  remotion-upgrade --yes`, then update the header of this file. The weekly job reports when
  upstream moved; the owner runs the update.
- Node 22 (`.node-version`); `npm ci`, never `npm install` in CI.
- Light leaks need Remotion ≥ 4.0.500; in `@remotion/effects` 4.0.533 `hueShift` turns the other
  way from its docs (0 gold, 60 hibiscus, 120 orchid, 240 turquoise, 300 lime) — verified in
  SunsetDream.

## 12. Anti-patterns (what makes AI video look like AI video)

Three that no rule above derives, and the reason the rules exist:

- **Adjective briefs** ("modern, sleek") → the median tutorial video: centred 80 px headline,
  purple-blue gradient, a 20 px fade-up. Fix: a shot list with seconds and exact copy (the brief
  template).
- **Scene-to-scene drift** when each video is prompted from scratch (≈19 % duplicated UI, one
  role at five sizes) → the kit (§6) and this file.
- **No eyes:** "it compiles" is not "it is good" → stills and a reviewer, every time (§9).

The rest are §3–§7 stated in the negative — stacked crossfades, bouncy springs on type,
`Math.random()` / CSS transitions / GSAP / `translateZ(0)`, a prompt's safe zone instead of the
platform's, invented facts, per-letter or letter-spaced Arabic, a logo first.

## 13. Out of scope now, documented for later

- **Voice-over / TTS:** Hebrew needs ElevenLabs *Eleven v3* (or v4) — Multilingual v2 and Flash
  v2.5 have Arabic but not Hebrew; time captions from TTS timestamps or forced alignment, never
  from ASR, when the script is known. **Transcription of real speech:** whisper.cpp
  `large-v3-turbo` with the language set (the Remotion default `base.en` is English-only); stock
  Whisper is weak in Hebrew (ivrit.ai fine-tunes exist); a human proofreads Hebrew / Arabic
  captions. Captions through `@remotion/captions` (TikTok-style pages, mid-frame).
- **Music / SFX** with a license line (rule 1.6); duck −12 dB under a voice.
- **TikTok (240 / 660 / 120 px, rail ~180–300 px) and YouTube Shorts (288 / 672, 48 left /
  192 right)** safe-zone profiles.
- **English** reels; **Lambda** / cloud renders; the **Player** in an app (counts as automation
  under Remotion's terms — a license question).
- **Personalised-at-scale** (GitHub Unwrapped pattern: data → JSON props → one template → many
  renders) — the structure in §6 allows it; the license decides when.

## 14. Sources and confidence

Vendor pages were weighed on their specifics, not their conclusions. *(official)* = the
platform's or Remotion's own page; *(practitioner)* = a named practitioner; *(vendor)* = sells a
related product.

- Meta Ads Guide — Reels / Stories safe zone 14 / 35 / 6 % *(official)*; Meta Business Help Center
  — 40 % with a disclaimer *(official)*; Facebook for Business, "Capture Attention with Updated
  Features for Video Ads" — the 47 % / 74 % figures *(official, self-reported Nielsen finding)*.
- Remotion Agent Skills `remotion-dev/skills` 4.0.532 — markup, timing, transitions, fonts,
  interactivity, rendering rules *(official)*; `remotion.dev/docs/license` — free for ≤ 3 people
  *(official; re-check before any purchase)*.
- Sabrina Ramonov, "5 INSANE Claude Code + Video Prompts" (2026-03-21) — prompt skeleton, the
  testimonial pattern *(practitioner; her 150 / 170 px zone and "generate a plausible URL" are
  rejected above)*.
- snapcn, "Why AI motion graphics all look the same" (2026-10-01) — shot lists, hard cuts, scale
  contrast, render stills *(vendor)*.
- Roboto Studio, scene-kit skill (2026-07-06, upd. 2026-08-24) — tokens + kit + hard rules, drift
  measurements *(practitioner)*.
- RTL: MDN on `letter-spacing` and joined scripts; W3C note on text-stroke; the LibreChat
  per-word fix; a Mahdia festival PR adding `direction: rtl; unicode-bidi: plaintext` to a caption
  overlay *(mixed; the rules are Chrome behaviour, not Remotion's)*.
- ElevenLabs Help Center (v3 languages incl. Hebrew), `@remotion/install-whisper-cpp` docs,
  Voicenter's Hebrew WER benchmark, ivrit.ai *(mixed; unverified items are marked in §13)*.
- Unverified as of 2026-10-06: Hebrew in ElevenLabs v4 and Forced Alignment; v3 timestamp
  output; ivrit.ai ggml inside Remotion's `transcribe()`; WhatsApp status specs; the exact Google
  Font subset keys beyond `hebrew` / `arabic` / `latin`.

## Changelog

*Newest first; the weekly job adds its entry at the top.*

### 2026-10-06 — kickoff
- First version, distilled from the owner's research document, the installed Remotion Agent
  Skills 4.0.532 and the repo's rules (FACTS, names, HE + AR, ADR 0055, never deployed).
- Decisions recorded: Meta only, no audio, free license at ≤ 3 people, skills per machine
  (ADR 0064).
- Moved from `.claude/skills/new-video/guidelines.md` to `video/GUIDELINES.md` the same day:
  `.claude/` is a protected path the weekly job's agent cannot write under (ADR 0064, amended).
