# `brand/` — the Lev Yam brand in words

The brand rules a person or a skill needs without opening the brand book. **A source, never read
at build** (ADR 0069 §5): `tokens.json` is what the check compares the site's CSS and the reels'
themes against; `assets.json` names every logo and icon by ID and the files that serve it. The
model and the ID grammar: [`content/README.md`](../content/README.md).

The brand book itself (`ספר מותג - לב ים.pdf`, 7 pages, the designer's) lives in Drive
`Lev Yam — Content System/Brand/00 Rules`, not here — it is large and it carries specimen contact
details. Git history keeps the copy that was once tracked in `docs/`.

## Colour

Three brand colours, from the brand book — their values are [`tokens.json`](tokens.json) `brand`;
use them as they are, never a tint of your own:

| Token | Where |
|---|---|
| `cream` | backgrounds — the page, the reel's canvas |
| `orange` | the sun, the waves, calls to action |
| `blue` | the palm, the house, links, `theme-color` |

The site added shades around them (`derived` in `tokens.json`: deep blue and orange for hover and
contrast, ink for text, a line colour). A new colour starts in `tokens.json`; the check fails a
`--color-*` in `css/styles.css` or a hex in `video/src/**/theme.ts` that is not there (spacing and radii too).

## Logo

- **Forms** (brand book p. 1–3, 5): the full logo (palm, sun, house, waves + the wordmark
  "לב ים"), the mark alone, the extended lockup with the wordmark beside it, and a **negative /
  one-colour** version for single-colour uses (stamp, embroidery, a photo background).
- **Never:** recolour outside the three colours, stretch, rotate, outline, add a shadow, put the
  full-colour logo on a busy photo (use the one-colour version on a calm area), or retype the
  wordmark in another face.
- **Clear space and minimum size are not set by the brand book** — they are on the designer's
  starting list (below). Until the designer sets them, follow the brand book's own examples
  (p. 5, 7) and never crowd the logo against an edge or another mark.
- Logo **first** is an anti-pattern in reels (`video/GUIDELINES.md` §12): the logo signs off, it
  does not open.

## Type

- **Brand face: Futura 100** (Light → Bold) with its Hebrew and Arabic cuts — the brand book's
  face. It is **not licensed for the web**: the site and the reels use **Assistant** (display)
  and **Heebo** (body), Noto Sans Arabic for Arabic in reels. Buying the Futura web licence or
  approving the Heebo/Assistant pair as brand faces is open (the plan's open question 5 —
  owner + designer).
- Hebrew and Arabic are never letter-spaced (joined scripts break; GUIDELINES §4).

## Icons

The icon set (brand book p. 6; `Brand/20 Icons` holds all 31) is line drawings in the brand
colours. Four are on the site (`assets.json`): **palm** — the place; **sun** — the weekend, the
time outdoors; **house** — the venue, a home by the sea; **heart** — community. An icon carries one
of these meanings wherever it appears; a new meaning is a new icon from the designer, not a reuse.

## Assets and where they come from

- `assets.json` — every logo and icon by ID (`brand-<kind>-<name>`), with the files the site
  (`img/logo/`, `img/icons/`, the homepage logo build in `img/hero/h*.png`) and the reels
  (`video/public/brand/`) serve. Those served paths stay where they are.
- **Masters** — the designer's finals were *copied* into the owner-owned `Brand/` in Drive (a copy
  belongs to whoever makes it; the designer stays editor there and delivers to `Brand/00 Inbox`).
  No vector master exists yet: the served PNGs are the best copies held. When vectors arrive they
  go into `brand/assets/` with their IDs and `scripts/media.sh --brand` (PR C) writes the served
  files from them.
- Templates, flyers, print files and anything priced stay in Drive — never in this repo.

## The designer's starting list

The designer guide (Hebrew, a Google Doc in `Brand/`) asks for, in order: vector masters (SVG +
PDF) of every logo form and the icon set · the Futura licence decision with the owner · a one-page
usage text (clear space, minimum size, the do/don't above) · empty template masters for
Instagram 4:5 and 9:16, Facebook, GBP and WhatsApp status at the `content/channels.json` sizes ·
icon names matching the meanings above. Then monthly: the look of the month and seasonal
proposals (`calendar.md`), delivered to `Brand/00 Inbox` and logged in the delivery log.
