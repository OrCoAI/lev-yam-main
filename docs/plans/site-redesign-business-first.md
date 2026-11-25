# Marketing site — redesign, business events first

*Kickoff 2026-11-23 · branch `site-redesign-business-first` · roadmap block: Phase 2 (2026-Q4
mandate), item 1a · tier: A (ADR 0015) — the diff touches `scripts/assemble-site.sh`,
`.github/workflows/` (smoke routes) and `js/wa-track.js`*

## Why

The mandate's positioning is "focus on private and business events", and the content themes put
companies and teams first ([ADR 0070](../decisions/0070-content-themes-are-audiences-business-first-the-place-is-the-setting-of-every-post.md)).
The site does not say so yet:

- The homepage section "מה קורה בלב ים" shows five services as five equal cards with five equal
  orange buttons. On a phone, business events is one screen of five — and 203 of 217 sessions
  were on phones (Marketing report 2026-W47, issue #193).
- The page built to sell business events lives on another domain (`b2b.levyam.com`, repo
  `OrCoAI/lev-yam-b2b`), with Dynatrace only. GA4, Meta Pixel and the weekly marketing report
  never see it, and the homepage does not link to it.
- The pages that bring the most visits have no way to the business offer: `/happening/` pages
  had 141 of the week's 217 sessions and converted 4–5%; the homepage had 50 and converted 36%.

## Outcome metric

| | |
|---|---|
| Metric | (1) `whatsapp_click` per week with `page_slug = business`; (2) the share of homepage sessions that click through to `/business/` |
| Source | GA4, as delivered in the weekly marketing report (`.reports/analytics.json`). (2) is read from Enhanced Measurement's `page_view` on `/business/` with `page_referrer` = the homepage — no new GA4 event (ADR 0006); Dynatrace `levyam.service_interest` (`cta.source`) says which homepage link was used |
| Baseline (today) | (1) 0 — the page is not in GA4; its Dynatrace `levyam.whatsapp.click` count is read once before ship and written here. (2) 0 — no link exists. Context: homepage 18 `whatsapp_click` / 50 sessions, week ending 2026-11-22 |
| Target | (1) at least 5 a week by the check date; (2) at least 15% of homepage sessions. Site-wide `whatsapp_click` does not fall below its 4-week average on the ship date (the guard) |
| Check date | ship + 3 weeks — the date is written here at merge; the marketing report lists it when due |
| Verdict owner | owner |

## Scope

One spec, shipped as two PRs so staging never carries a half-built site.

**PR 1 — the business page moves in (live, not yet linked)**

- `business/index.html` served at `levyam.com/business/`, from `lev-yam-b2b`'s `index.html`,
  `css/style.css`, `js/main.js` and built media. It keeps its own look (owner, 2026-11-23).
- Its header and footer become the site's: the same nav, language toggle and footer as every
  other page, drawn in the page's own colours.
- Fonts self-hosted: Heebo from `fonts/`, plus a Cairo subset added for this page's Arabic.
- WhatsApp clicks go through `js/wa-track.js` with `<body data-page-slug="business">`; the
  page's other events (planner steps, component opens) stay Dynatrace-only (ADR 0006).
- Title, description, canonical, Open Graph, `EventVenue` JSON-LD; an entry in `sitemap.xml`
  (the generator) and in `llms.txt`.
- `scripts/assemble-site.sh` allowlist and the deploy smoke routes gain `/business/`.
- Left behind in `lev-yam-b2b`, never copied: its price list, its private business
  documents, `worker/`, `.env.example`, raw sources.
- `content/` records for every photo and clip that comes over (ADR 0069).

**PR 2 — the homepage, the shared chrome, the redirect**

- **Services section:** business events is the lead — one full-width card, drawn in the
  business page's cream look so the click feels like stepping through a window into that
  page; one orange button, to `/business/`. Private events second and smaller. Rental,
  community Sunday and weekends as compact rows with quiet text links.
- **Hero:** the first button goes to `/business/`; "דברו איתנו" stays second. The lead
  sentence names events.
- **Navigation:** fewer items, "אירועים עסקיים" marked; one template edit per language,
  stamped into story pages, both `/stories/` hubs, both `/happening/` hubs and the landing
  pages in the same release. This closes the 961–1300px header overlap bug (roadmap item 4).
- **Planner for the whole site:** the four-step WhatsApp planner replaces the four
  "מה תרצו לעשות?" buttons on the homepage. Its first question covers every audience
  (business day · private event · renting the venue · weekend visit · community · "I have a
  dream") and each answer leads its own short path. `/business/` keeps the business path.
  One script, two pages.
- **Business strip:** one quiet line, "מתכננים יום לצוות?" → `/business/`, in the generated
  chrome of story pages and `/happening/` pages, above the footer
  ([ADR 0075](../decisions/0075-site-redesign-business-first-two-looks-one-chrome-a-business-strip.md)).
- **Two looks, one seam:** the homepage keeps its blue bands, the business page its cream.
  What is shared: the header structure, the stamp, the button shapes, the type scale and the
  wave divider as the edge between the two looks.
- **`b2b.levyam.com` redirects** to `levyam.com/business/` once PR 2 is on prod (a redirect
  page with a canonical in `lev-yam-b2b`, or a DNS-level redirect — open question).

## Explicitly out of scope

- **Proof section** (facts strip, testimonials, company logos) — needs text and consent from
  the owner first; its hidden slots on the business page stay hidden.
- **One URL per language** for the homepage or `/business/` — both keep the client-side
  language switch; a per-language URL is its own SEO initiative.
- **New copy for the business page** — its text is the copy doc's; this spec moves it, it does
  not rewrite it.
- **Prices, packages, payments** — never (FACTS rules; the legacy payment stack stays unused).
- **English**, the survey page, `/app` — untouched.
- **A redesign of story or initiative page bodies** — only their generated chrome changes.

## Schema, RLS, permissions

None. No table, policy or permission changes; the planner stores nothing.

## UI surface

- Public pages: `index.html`, `business/index.html` (new), `stories/_template*.html`,
  `stories/_hub*.html`, `happening/_item*.html`, `happening/index.html`, `happening/ar/index.html`,
  `404.html`; `css/styles.css`, a new `css/business.css`; `js/app.js` (dictionary), a new
  `js/business.js` and `js/planner.js`.
- HE + AR for every new or changed string. The business page's Arabic is marked draft in its
  repo: the owner's reader pass is required before PR 1 merges (invariant 5, ADR 0069).
- Phone-first: every section is designed at 360 / 390 first, then 1280.
- Step zero: one screen first — the new services section at 390px — shown to the owner before
  the rest is built; then headless screenshots at 360 / 390 / 1280 in both languages for the
  homepage, `/business/`, one story page and one initiative page.

## Rollback

- PR 2 is one revert: the homepage, nav and strip return; `/business/` stays live and unlinked.
- The `b2b.levyam.com` redirect is switched back in `lev-yam-b2b` (the repo stays intact,
  not archived, until the outcome check passes).
- No data is created, so nothing is left behind.

## Checks

- **Roadmap:** not a line in the Q4 mandate at kickoff; added as item 1a by the owner on
  2026-11-23 (ADR 0075). It serves the mandate's positioning and closes one open bug of item 4.
- **Architecture:** invariants 1–8 walked. 3 (no PII, no secrets) — binds what is copied from
  `lev-yam-b2b`; the two files named above stay behind. 5 (HE + AR) — binds the Arabic pass.
  1, 2, 4, 6, 7 — no schema, no keys, no live tool replaced. 8 — the roadmap line is added.
  Verdict: holds.
- **Vision:** serves the Join circle and principle 4 (public by default); principle 7
  (evolution, not revolution) — `b2b.levyam.com` keeps working until `/business/` is proven,
  then redirects. Verdict: aligned.

## Open questions

Blocking (before the planner is built):

- **The planner's new paths** — the wording of the first question and of the private, rental,
  weekend and community paths, HE + AR. Claude drafts, the owner approves. (owner)

Non-blocking:

- The redirect's form (redirect page vs DNS) — decided at PR 2.
- What happens to the old repo's own files — owner (answered 2026-11-25, below).
- The exact nav items that stay — settled on the first screen review.

## Decisions made on the way

- 2026-11-23 · the redesign enters the Q4 mandate as item 1a; `/business/` on the main domain;
  each page keeps its own look; a business strip on story and initiative pages; the planner
  serves the whole site · [ADR 0075](../decisions/0075-site-redesign-business-first-two-looks-one-chrome-a-business-strip.md)

- 2026-11-23 · Gate 1 approved by the owner. Arabic on `/business/` uses a self-hosted Cairo
  subset in `fonts/` (that page only). The page's photos and clips come over as built, and
  their `content/` records are written in PR 1; originals replace them when they reach Drive.

- 2026-11-23 · owner: "work on everything but the photos update". Built, uncommitted: the
  business page at `/business/` (it keeps its own header with the page anchors, the logo leads
  home, a footer leads back into the site); the header that stays on scroll; nav cut to five
  with the business entry marked; the homepage planner (the old buttons are its first answers,
  the opening sentences are the old `wa_msg_*` strings, sizes and months are the business
  page's); a facts line, three FAQ answers and a new title, description and hero line, all
  from `FACTS.md`; Cairo for Arabic site-wide; the business strip. Business clicks are counted
  in `js/wa-track.js` (Dynatrace `levyam.service_interest`, `cta.source`).
- 2026-11-23/24 · owner: "a final touch… deep work on the details… mobile and desktop". Four
  read-only reviews (homepage, business page, stories/initiatives/404, QA) fed one fix pass.
  Decided on the way:
  - **One chrome script, `js/chrome.js`, on every page** — the stuck header, the phone menu's
    backdrop / tap-outside / scroll lock, and the floating button's manners. The copies in
    `js/app.js` and `js/business.js` are gone; story and initiative pages get it from the
    stamped `chrome:footer` region (ADR 0049's mechanism, unchanged).
  - **The header, menu, footer and story CTA band show the stamp** (`logo-mark.png`): the
    one-colour logo's blue parts vanish on the blue and dark grounds.
  - **The business strip is the footer's first row** (dark), not a cream band.
  - **Hub cards carry their own text** (`cardExcerpt()` in `gen-stories-index.mjs`): the
    description without its title-restating opening, cut at a whole word.
  - **Weekend hours stay on the weekend card** as a second line under the owner's new
    sentence — `check-content` requires the FACTS Friday hours there.
  - **Text on orange is ink everywhere**; the business nav pill is framed, not filled, on
    its own page.
  - **The homepage hero film has three renditions, each inside the phone budget:** a
    landscape cut for wide screens (2.0 MB, was 5.9 MB), the portrait cut for phones, the full
    frame at tablet size; none is fetched under reduced motion. `/business/` remembers a
    language only on an explicit choice (as `js/stories.js` does), and fetches a part's deck
    photos when that part is first opened.
  - **Open, the owner's call:** cream text on the brand blue is 3.3:1 at best — small text on
    the blue bands cannot reach 4.5:1 without a deeper blue for those bands.
  - **Left for the media round:** sharper sources — both hero films are small portrait clips
    stretched on desktop, the business card film is 478px wide, `gallery/01.jpg` is 708px. **Left as follow-ups:** the initiatives calendar reserving its space before the
    feed answers (→ `docs/modules/events.md`), a visible "page not found" on `404.html`.
- 2026-11-25 · owner's answers on the open items, "I want to go live asap":
  - **One PR** instead of two — the business page and the homepage now share the chrome.
  - **Hero line back to the original** ("מרחב פתוח על קו המים - לעבודה, מפגש, יצירה ומנוחה.");
    the description is the mission plus the business offer.
  - **`FACTS.md`:** "לב ים ממוקם בג'סר א-זרקא ופועל מתוכה ובשבילה" — the owner's new wording
    replaces "לא ממוקם".
  - **Map:** satellite under Lev Yam's own ArcGIS Location Platform key (the keyless Esri
    endpoint has no clear licence for a commercial site). Until the key is set, the owner
    keeps the satellite view on the public endpoint ("put back the map"); when its tiles
    fail, the street map that was live before.
  - **Consent:** the business page's activity photos — website; the sea photo's children —
    explicit parental consent for the website. Records written (`2026-11-activity-01`…`07`,
    `food`, `space`, `venue-film`; brand assets for the page's icons, stamp and share image).
  - **Arabic:** a review sheet, read in parallel with the gate; the merge waits for it.
    **Signed off 2026-11-25:** the owner marked all 189 new or changed lines OK, none to fix.
  - **`b2b.levyam.com`:** after prod, a redirect to `/business/`, and the old files removed
    from `lev-yam-b2b`.
  - **Security review (2026-11-25):** the old page's working files were removed from what
    `b2b.levyam.com` serves (owner's go-ahead, same day). Once `/business/` is live,
    `lev-yam-b2b` goes private and `b2b.levyam.com` becomes a redirect served from a repo
    that holds nothing else.
  - **Contrast (Claude's call):** cream on the brand blue is 3.3:1, so the few small lines on
    the blue bands are set large and bold (≥19px, 700) — the bands keep the brand blue.
- **Still open:** the ArcGIS key (the map uses Esri's public endpoint until it arrives; not a
  merge blocker). **After launch (follow-ups):** the photo round — sharper originals for both
  hero films, the business card film and `gallery/01.jpg`, the photo for "מי אנחנו", the
  gallery order; the business page's icons at their drawn size (they ship at 372–613px).
- **Gate cleanup (`/simplify`, 2026-11-25), left for after launch:**
  - One shared `css/chrome.css` instead of the scoped copy in `css/business-chrome.css` (every
    page head links it; story heads are outside the stamped region).
  - `js/chrome.js` owns the menu's open/close too (labels from `data-label-open/close`), so the
    four page scripts stop carrying their own copy.
  - One header-height token; the business page still sizes its hero by its old `--header-h`.
  - One planner vocabulary for the homepage planner and the business page's (`js/planner.js`
    and `js/business.js` keep their own strings today).
  - The business page's chrome on the homepage's i18n attribute names; one `css/fonts.css`
    (the chrome falls back to Heebo on `/business/`, which does not load Assistant).
  - Pages opt into the floating button's "step aside" with a `data-` attribute, not a
    selector list in `js/chrome.js`; the button's look on `/business/` (58px, hidden on
    desktop) and the site's (56px, shown) made one.
  - A no-JS menu for the story and initiative pages (a static menu would overflow their
    fixed-height header band).

## Close-out
*(appended when done — CLAUDE.md "Roadmap item close-out")*

## Outcome check
*(appended on the check date: metric value vs target, verdict, what it changes)*
