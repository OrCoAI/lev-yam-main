# Events — Public "What's happening"

*Kickoff 2026-09-25 · branch `events-whats-happening` · roadmap block: Phase 2 — 2026-Q4 mandate,
item 8 · tier: **A** (ADR 0015 — `supabase/`, `scripts/assemble-site.sh`, platform `shell/`)*

## Why
Lev Yam has a steady rhythm of public life — weekend open house with rotating content events,
the Sunday community, workshops — and none of it is visible anywhere a visitor can find it. The
site today sells private and business events only; a guest who would come on a Saturday has no
page that tells them what is on. The Q4 mandate ([ADR 0046](../decisions/0046-q4-2026-mandate-marketing-quarter.md))
put the public half of Phase 2 up front; this is the first time vision principle 4 ("public by
default") and invariant 6 (visibility flag on public content) meet a real public table.

## Outcome metric
| | |
|---|---|
| Metric | (1) GA4 `whatsapp_click` with `page_slug` = `happening` or `happening-*`; (2) GA4 sessions landing on `/happening/*` (HE + AR); (3) Search Console impressions for `/happening/*` URLs; (4) *added at the PR 2 kickoff, ADR 0057:* GA4 `share_click` by `channel` on `happening-*` pages |
| Source | GA4 Data API + Search Console — the weekly-review analytics snapshot ([ADR 0047](../decisions/0047-analytics-wiring-ga4-and-gsc-only-public-numbers.md)) |
| Baseline (today) | 0 / 0 / 0 / 0 — the pages do not exist (2026-09-25) |
| Target | clicks ≥ 10 in the first 21 days; visits, impressions and shares are a first read (reported, no pass line) |
| Check date | ship + 21 days (date written here at merge) — `weekly-review` lists it when due |
| Verdict owner | owner |

## Scope
Owner decisions 2026-09-25 (alignment Q1–Q6):

1. **What the page shows — only what is live.** Weekend open-house events, community activities,
   workshops and ongoing initiatives the team publishes. An item disappears on its own when its
   date (or its recurrence's end) passes. Private/business events never appear — quote-sourced
   events are internal by construction.
2. **Two kinds of item:** a **dated** event (one date, optional start/end time) and a
   **recurring** activity (weekdays + hours, from a start date, until an optional end date). The
   list shows each item's **next** occurrence.
3. **Two ways to add an item ("both"):**
   - **Quick path — a form in `/app/events`** (owner + manager): HE + AR title, short summary and
     description, date or recurrence, times, one photo, publish / unpublish. Live on levyam.com
     ~~within seconds~~ **within minutes** (since the PR 2 kickoff — a rebuild, ADR 0056), no PR.
   - ~~**Big path — a static story-style page** for the major recurring items, written through the
     `story-author` flow as an HE + AR pair. The DB item then carries that pair's `story_slug` and
     the list links there instead of the generated detail page.~~ **Since the PR 2 kickoff (ADR 0056
     §7): every item gets its generated landing page; `story_slug` is an optional "read the full
     story" link on it, no longer a second way to add an item.**
4. **Public pages (HE + AR, one URL per language, `hreflang`):**
   - `/happening/` and `/happening/ar/` — the list of live items, next occurrence first.
   - A **detail page per item** rendered from the DB — full information, photo, and the
     WhatsApp CTA with a **prefilled per-item message** ("שלום, אשמח להגיע ל…" / AR twin).
   - **Event JSON-LD** on each detail page (dated items: `Event`; recurring: `Event` with
     `eventSchedule`). No `offers`/price — ever.
5. **Discovery:** "What's happening" in the site nav (homepage + story chrome via the generator
   templates) and a strip of the next 3 items on the homepage.
6. **A photo gallery per item** — up to 8, the first is the card's cover; the detail page shows
   them as a swipeable gallery. Public Supabase Storage bucket, uploaded (downscaled to ≤1600px)
   from the form. *(Widened from one photo by the owner at step zero, 2026-09-26.)*
7. **Arabic is required:** the DB refuses `visibility = 'public'` unless every HE and AR text field
   is filled (invariant 5 enforced in Postgres, not the form).
8. **Translate button** *(owner, step zero 2026-09-28, [ADR 0055](../decisions/0055-whats-happening-arabic-may-be-machine-drafted-but-never-published-unreviewed.md))*:
   "תרגום מעברית" drafts the Arabic through a new `translate` Edge Function (Google Translate,
   key server-side, `events.manage` re-checked, 8k-char cap, FACTS names pinned). The draft is
   flagged `ar_machine_translated`; CHECK `events_public_reviewed_arabic` refuses to publish it
   until the owner ticks "בדקתי את הערבית" or edits the Arabic.

**Delivery — two PRs, both Tier A:**
- **PR 1 — data + admin:** `58_events_public.sql`, storage bucket + policies, `rls_matrix`
  assertions, expose the `events` schema, enable the `events` module tile, `/app/events` list +
  form (HE/AR, phone-first), photo gallery, the `translate` Edge Function.
- **PR 2 — public surface** *(re-scoped at its own kickoff, 2026-09-28 — see "PR 2 — the landing
  pages")*: generated landing pages + hubs, `scripts/gen-happening.mjs`, `js/happening.js`, the
  `rebuild-site` function + the prod nightly schedule + `github.ref` guards on both deploy
  workflows, `59_events_landing.sql` (two optional fields, `events.passed`), share row +
  `share_click`, homepage strip, nav link in both `_template*.html` + generator, JSON-LD, prefilled
  WhatsApp, `assemble-site.sh` (env on the assemble step, underscore purge widened to
  `_site/happening`), `404.html` (`/happening/*` → `/happening/`), `ci.yml` fixture step, per-item
  `sitemap.xml` entries, `llms.txt` line.

- **Owner setup for the button:** a Google Cloud project with the Cloud Translation API enabled
  and billing on, an API key restricted to that API, then `supabase secrets set
  GOOGLE_TRANSLATE_API_KEY=…` on staging and prod. Until then the button answers "not configured".

## PR 2 — the landing pages (kickoff 2026-09-28, [ADR 0056](../decisions/0056-whats-happening-item-pages-are-generated-landing-pages-rebuilt-on-publish.md), [ADR 0057](../decisions/0057-ga4-carries-share-click-for-happening-landing-pages.md))

After PR 1 shipped, the owner set two requirements for the public pages, in their words:
*"I want those pages to be very easy to share through whatsapp or different ways through links.
The pages should be like a real cool landing page that is providing the full information of the
event and relevant information about lev yam."*

That widens scope item 4 (a detail page "rendered from the DB") into **a landing page per item**
and makes **link sharing a first-class outcome**. A shared link is judged by its preview, and
WhatsApp, Facebook, Telegram and iMessage build the preview from `og:*` tags **without running
JavaScript** — so per-item HTML has to exist on the server. That is the one decision that changed
the architecture (Q1 below). The kickoff ran as eleven closed-form questions plus one the owner
added; the answers are recorded here and in the two ADRs.

### Decisions (owner, 2026-09-28)

| # | Question | Decision |
|---|---|---|
| 1 | How a page gets its own preview | **A static page per item, generated at deploy from the feed and rebuilt when an item is published** (an Edge Function triggers the deploy workflow). Live in ~2–3 min. The page still refreshes from the DB on load. |
| 2 | URL shape | `/happening/<slug>/` and `/happening/ar/<slug>/` — the item's existing slug. |
| 3 | Share row | **WhatsApp share, copy link, native share sheet, QR for print.** A row under the hero **and** a sticky bottom bar on phones (CTA + share). |
| 4 | Landing-page blocks | Fixed on every page: hero, share row, full text, gallery, **also coming up** (next 3), **where & how to get here**, **about Lev Yam**, the **standard site footer** — in that order. *Not* included: a practical-answers block, a separate contact block, a village block (the CTA and footer carry contact). |
| 5 | Per-item fields | **Two optional structured fields**, HE + AR each: **who it's for** and **what to bring / meeting point**. Shown as labelled lines under the hero when filled. |
| 6 | CTA wording | Prefilled WhatsApp: HE `שלום, אשמח להגיע ל<שם> ב<תאריך>` (recurring: the next occurrence); AR twin in Levantine, native reader's pass before merge. Share text: `<שם> · לב ים · <link>`. **Plus: a written strategy for a real booking system** (see *Path to booking*). |
| 7 | Design | **Immersive, in the brand:** full-bleed cover hero with the title over it, minimal header (logo, language toggle, "כל האירועים"), sticky CTA/share bar on phones, brand fonts and colours, the standard footer. |
| 8 | Expired link | **"This one has passed" + the live list**, never a bare 404 while the item is recent. |
| 9 | Story pairs for big recurring items | **The landing page replaces them.** `story_slug` stays as an optional "read the full story" link on the page. Supersedes 0054 §3's second path as a *requirement*. |
| 10 | Measuring shares | **Dynatrace and GA4.** A second hand-written GA4 event, `share_click` — a deliberate exception to ADR 0006, recorded in ADR 0057. |
| 11 | Homepage strip + nav link | **Both in.** → **Strip out** (owner, 2026-09-29 staging review: initiatives appear only under `/happening/`); the nav link stays. |
| + | Booking system (owner's addition on Q6) | **A "Path to booking" section in this plan, and hooks in the build:** the CTA is one swappable block; nothing booking-related enters the schema now. Roadmap Phase 4 links here. |
| — | Delivery | **One PR, Tier A** (owner's choice over a 2a/2b split). |

### How it works

**Generation.** `scripts/gen-happening.mjs <tier>` runs inside `scripts/assemble-site.sh` after the
static copy. It reads the platform project's URL + anon key from the environment (prod: the
`VITE_SUPABASE_*` secrets, added as `env:` on the *Assemble site* step of `deploy.yml` — today they
are on the platform build step only; staging: the hard-coded staging values already on the step
that calls `build-site.sh`; local: the local stack), fetches `events.feed` and `events.passed`
(anon REST, the same column grants the browser has) and renders, from `happening/_item.html` /
`_item.ar.html`, one page per item per language into **`_site/` only** — never into the checkout,
because the items are not known at commit time. **The hubs** `/happening/` and `/happening/ar/`
work the same way: `happening/index.html` and `happening/ar/index.html` are committed shells with
an `<!--ITEM_LIST-->` marker (the marker idea from `stories/_hub.html`; unlike it, these shells are
themselves served — the marker is a comment and `js/happening.js` fills it on load), the generator
writes the filled copy into `_site/` so the cards are crawlable, and `js/happening.js` refreshes
them from the feed on load. So the generator has **two targets**: chrome stamping into the
*checkout* (the happening shells and templates, like story chrome — with its own `--check` mode in
`ci.yml`, since the stories check does not cover them and a footer edit would otherwise drift
silently), and item/hub fill into `_site/` only.
The underscore purge in `assemble-site.sh` is widened to `_site/happening` so `_item*.html` is
never served. The generator also appends the live items' URLs (both languages, reciprocal
`hreflang`) to `_site/sitemap.xml`. A feed fetch failure **fails the build** — a site whose shared links 404 is
worse than a delayed deploy; a re-run fixes it. `ci.yml` runs the renderer against a committed
fixture (`--fixture`, no network) so the templates are tested on every PR. The generator stamps
the `chrome:footer` region of the happening templates and hubs the way `gen-stories-index.mjs`
stamps story chrome (ADR 0049), so a footer change stays one edit per language.

**Rebuild trigger.** New Edge Function `rebuild-site`: signed-in caller, `events.manage`
re-checked server-side, then `POST /repos/OrCoAI/lev-yam-main/actions/workflows/<workflow>/dispatches`
with `{ ref }`. Secrets per project, set one by one (`supabase secrets set NAME=value`, never
`--env-file`): `GITHUB_DISPATCH_TOKEN` — a **fine-grained PAT scoped to this one repository with
Actions: read + write only**. Honest scope: it can dispatch, re-run, cancel or delete runs of any
of this repo's `workflow_dispatch` workflows **on any ref the caller names** (the ref is a request
parameter, not a token property); it cannot push code, read secrets or change settings. Two
guards make the rebuild the only thing it can *publish*: a job-level `if: github.ref ==
'refs/heads/main'` on `deploy.yml` and `if: github.ref == 'refs/heads/staging'` on
`deploy-staging.yml` (a dispatch on any other ref no-ops *once that ref carries the guard* — a
dispatch runs the workflow file at the dispatched ref, so a stale branch that predates the guard is
not covered; the guard must test `github.ref`, never `event_name == 'push'`, because the nightly
schedule and the `rebuild-site` dispatch both run on `refs/heads/main` and must pass it), and, as
the prod backstop that does not depend on the ref, the `github-pages` environment's
deployment-branch policy, which is already `main` only. Staging has no such policy, so its bounded
exposure is a stale branch published to a noindex tier. The report workflows it could also fire only
burn a subscription run. 1-year expiry noted in
`supabase/README.md`; `REBUILD_WORKFLOW`
(`deploy.yml` / `deploy-staging.yml`); `REBUILD_REF` (`main` / `staging`). Local dev answers
`not_configured`. The form calls it after any save that changes public state (publish, unpublish,
edit of a public item) and shows "העמוד הציבורי יתעדכן תוך כמה דקות". Repeated calls collapse
into the workflow's own `concurrency` group. Telemetry: fixed result codes only (ADR 0013).
**Nightly rebuild — prod only:** `deploy.yml` gains `schedule: cron '30 22 * * *'` (00:30 / 01:30
Jerusalem) so a passed item leaves the sitemap and flips to its passed state without anyone
publishing. **Not on staging:** a `schedule` trigger always runs from the default branch, so a
staging nightly would overwrite whatever branch is mid-verification with `main` (ADR 0012 flow);
staging rebuilds only on push or on the `rebuild-site` dispatch with `ref: staging`. Consequence
for the staging sign-off: staging never retires a passed item on its own, so the passed state is
verified there through the load-time flip or by pressing publish/unpublish once in `/app/events`
(which dispatches with `ref: staging`) — that is a named step in the staging click-list. Same rails
as the report jobs (ADR 0039 spirit): a scoped token, a workflow that only rebuilds, no agent.

**Expired state.** `events.passed` is a second anon-readable view: public items whose last
occurrence passed within the last 90 days, same public columns. The generator renders them with
`noindex`, a "האירוע הזה כבר עבר" banner, the next-3 block and the CTA, and leaves them out of
the sitemap. After 90 days the page is gone and `404.html` routes `/happening/*` to
`/happening/`. Every generated page also checks the feed on load: an item that passed since the
last rebuild flips to the passed state at once, and text/gallery edits show without waiting. A slug
found in neither view (unpublished since the last rebuild) renders an *unavailable* state on load —
a neutral line ("הפריט אינו זמין כרגע", not the "passed" banner, which would be untrue for a
withdrawn item) plus the next-3 block — so an unpublish is honoured within seconds even before the
rebuild lands.

**The page** (HE and AR, one URL each, `hreflang`, `canonical`, `og:title` = item title,
`og:description` = summary, `og:image` = cover at 1200-wide, `Event` JSON-LD with
`eventSchedule` for recurring items, `location` = Place with FACTS' coordinates, no `offers`):
1. **Hero** — cover photo full-bleed, title, when (next date + time, recurrence line), summary;
   WhatsApp CTA (prefilled) + share row (WhatsApp · copy · share · QR).
2. **Who it's for / what to bring** — labelled lines, only when filled.
3. **Full text** (`body_*`) — ~~then a "read the full story" link when `story_slug` is set~~
   (dropped 2026-09-29, ADR 0058: no link between initiatives and stories; the tiles now also
   carry cost + booking, and "also coming up" became "יוזמות נוספות", last on the page).
4. **Gallery** — swipeable, the same image set as the form (cover first).
5. **Also coming up** — the next 3 other live items (rendered at build, refreshed on load).
6. **Where & how to get here** — Waze "לב ים", Google Maps by coordinates, drive times from
   Tel Aviv / Haifa / Caesarea / Hadera, "parking at the entrance", the partial-accessibility
   line. Car only; public transport is unverified in FACTS and is not written.
7. **About Lev Yam** — 2–3 lines from FACTS §זהות + 2–3 venue photos from the existing gallery.
8. **Standard site footer.**
On phones a **sticky bottom bar** keeps the CTA and share reachable. The QR is rendered at build
time as inline SVG (the `qrcode` package as an `app-src` devDependency, imported from `scripts/`
through `createRequire` against `app-src/package.json` since there is no root `package.json`;
`npm ci` in `app-src` already precedes assemble in both deploy workflows, and the `ci.yml` fixture
step is placed after "Install platform dependencies" for the same reason — already installed before
assemble runs; no client JS, no CDN), behind a "QR להדפסה" toggle.

**Analytics.** `js/wa-track.js` gains `LevYamTrack.shareClick({ channel, lang })` → Dynatrace
`levyam.share` (`event.channel`, `event.lang`, `event.page_slug`) and GA4 `share_click`
(`page_slug`, `channel`, `lang`); no Meta event. The CTA reuses `whatsappClick` with
`source: 'happening-cta'` / `'happening-sticky'`. `<body data-page-slug>` = `happening-<slug>`
on item pages, `happening` on the hubs.

**Schema — `supabase/schema/59_events_landing.sql`** (Tier A, hand-applied to prod with the
same before/after record as 58):
- `audience_he`, `audience_ar`, `bring_he`, `bring_ar` `text not null default ''`.
  CHECK `events_public_optional_bilingual`: public ⇒ each optional field is filled in both
  languages or in neither (invariant 5 for every shown text). Added to `events.feed`, to the
  anon column grants, to the form (HE/AR side by side), and to the `translate` function's field
  list (the 8k cap holds; translating them also sets `ar_machine_translated`).
- `events.passed` view (above), `security_invoker`, `grant select` to `anon, authenticated`.
- The open question from the PR 1 gate: `events.valid_image_paths(id, paths)` now pins each
  path to the row's own `<id>/` prefix, so two rows can never reference one object.
- `rls_matrix.sql` gains: anon reads the new columns through `feed`; `passed` shows a recently
  passed item and hides one older than 90 days and any internal row; manager cannot publish an
  item with `audience_he` filled and `audience_ar` empty; a path under another row's id is
  refused.

**Homepage nav.** ~~`index.html`: a "מה קורה" strip (next 3 items, rendered in the browser
from the feed — the homepage is not per-item)~~ (removed 2026-09-29: the homepage carries no
initiatives, only the nav entry) + a nav entry linking `/happening/`; dictionary keys HE + AR in
`js/app.js`. Story chrome: the same nav entry in `_template.html` / `_template.ar.html`
(one generator run stamps every story page).

**Owner setup (before staging sign-off):**
0. *(done 2026-09-29 in the build session)* 59 applied on **staging** with
   `supabase db query --linked -f supabase/schema/59_events_landing.sql` followed by
   `notify pgrst, 'reload schema'` — **and the same for `60_events_cost.sql`** (2026-09-29; it
   drops `story_slug`, so any staging row that linked a story loses the link by design). **Always
   `supabase db query` on a tier, never `psql -f`:** `db query` runs the file as one statement
   through the management API, i.e. one transaction, so 60's drop-CHECK → re-add-CHECK sequence
   cannot be left half-applied; `psql -f` autocommits per statement (locally use `psql -1 -f`).
   `db query` does not return `raise notice`, so **before** applying 60 on a tier run
   `select slug from events.events where visibility = 'public' and (btrim(body_he) = '' or btrim(body_ar) = '')`
   — those rows are the ones 60 demotes to internal (they published through a story link) — (a new view is invisible to PostgREST until the cache reloads —
   the first staging deploy failed on `events.passed` 404 for exactly that reason). **Not**
   `supabase db push`: the staging project's migration history does not record the baseline, so a
   push would replay all 25 schema files, including the pre-cut-over POS layers the README warns
   about. Prod (step 4) is applied the same way, by hand, followed by the reload notify.
1. GitHub → Settings → Developer settings → Fine-grained tokens → *Generate new token*: resource
   owner `OrCoAI`, **only** repository `lev-yam-main`, repository permissions **Actions: Read and
   write**, nothing else, expiry 1 year. Copy it once.
2. `supabase secrets set --project-ref vhvghcehkcbtygomixmu GITHUB_DISPATCH_TOKEN=<token>`, then
   `REBUILD_WORKFLOW=deploy-staging.yml`, `REBUILD_REF=staging` (three separate commands). Prod:
   `--project-ref teyxtdccsrkdpqnbfcga`, `REBUILD_WORKFLOW=deploy.yml`, `REBUILD_REF=main`.
   **Staging wired 2026-09-30:** token `lev-yam rebuild-site` (only `lev-yam-main`, Actions read +
   write) **expires 2027-09-29**; it sits in the owner's keychain as `levyam-rebuild-pat`, and prod's
   `GITHUB_DISPATCH_TOKEN` is set from there the same way, so the value never passes through a chat
   or a file. A direct dispatch with it answered 204 and the staging deploy it started went green.
3. `supabase functions deploy rebuild-site --no-verify-jwt --use-api --project-ref <ref>`, and
   **redeploy `translate`** the same way (`supabase functions deploy translate --no-verify-jwt --use-api --project-ref <ref>`):
   this PR adds `audience`, `bring` and `cost` to the fields the function drafts, and a copy
   deployed before that silently skips them — the button answers 200 and leaves the three
   Arabic lines empty. Staging redeployed 2026-09-29; prod goes with step 4.
4. Hand-apply `59_events_landing.sql` **then `60_events_cost.sql`** on prod after the staging round **and before the merge**
   (the prod build fetches `events.passed` and fails closed without 59; without 60 the public
   site still builds but **`/app/events` is unusable** — its column list names `cost_he`,
   `cost_ar`, `booking_required`, so every list read answers 400 — and no audit catches a
   missing file, only surplus privileges), then
   `notify pgrst, 'reload schema'`, then `node supabase/tests/audit-grants.mjs --ref teyxtdccsrkdpqnbfcga`
   → 0 drift, and probe as anon: `/rest/v1/passed` answers 200, `/rest/v1/events?select=notes` is refused.
   Then the prod `translate` redeploy from step 3 (an anonymous POST still answers 401).

### Path to booking (strategy — Phase 4, not built here)
Written at the owner's request on 2026-09-28 so PR 2 leaves the door open. Roadmap Phase 4
"Event signup/tickets on the public feed (capacity, confirmation)" links here.
- **Data:** `events.events.capacity` already exists (spine, `40_events.sql`). Booking adds one
  table, `events.signups` (`event_id`, `occurrence_date` for recurring items, contact fields,
  `party_size`, `status` requested → confirmed → cancelled, a verification token), with **anon
  insert only through an Edge Function** that verifies the phone/email (Phase 4's rule for the
  bookings module) — never a direct anon insert policy. Staff read via `events.view`; no PII in
  the public views. A `spots_left` computed column on `feed` (capacity − confirmed) is the only
  public number, and only when capacity is set.
- **The page:** the CTA is built now as **one swappable block** (`<section data-cta>`): the
  WhatsApp button today; in Phase 4 a "שמרו לי מקום" form when the item has a capacity, with
  WhatsApp kept as the parallel channel. The sticky bar and the share row do not change.
- **Confirmation:** the Phase 4 notifications channel (WhatsApp/email) sends the confirmation;
  until it exists, a signup is a request the team answers by hand from `/app/events`.
- **Sequence:** notifications channel → `events.signups` + function → CTA block swap. Each is its
  own kickoff after the 2027-01-01 review; nothing here changes the Q4 mandate.

### Changes to earlier decisions
- 0054 §3's second path (a written story pair for the big recurring items) is no longer a
  requirement; `story_slug` is an optional link (ADR 0056). **Then dropped altogether: an
  initiative's page stands alone, no link to stories (ADR 0058, 2026-09-29).**
- Rows 5, 7 and 9 of the PR 2 table are superseded by ADR 0058: a third structured field pair
  (cost) plus a booking flag; the full site header instead of the minimal one, "יוזמות נוספות"
  last; no story link.
- 0054 §4 "live within seconds, no PR" → "live within minutes, no PR" (ADR 0056).
- Out-of-scope item "per-item URLs in `sitemap.xml`" is **in**: the generator writes them.
- ADR 0006's "one hand-written GA4 event" gains a second, `share_click` (ADR 0057).

## Explicitly out of scope
- **Member-proposed initiatives** (propose → approve → run) — Phase 3. The owner's "initiatives"
  here are items the *team* publishes; Phase 3 initiatives will project into the same table.
- **Signup / tickets / capacity booking** — Phase 4; the CTA is WhatsApp only. The *path* is
  written above ("Path to booking"); nothing of it is built.
- **The internal bookings calendar / reservation CRUD** — the deferred internal half of Phase 2.
- **Prices** — never, anywhere (FACTS rule); no `offers` in JSON-LD.
- **Past events archive** — the owner chose "only what is live".
- ~~**Per-item URLs in `sitemap.xml`**~~ — **in since the PR 2 kickoff** (generated at deploy).
- **English** (`/happening/en/`) — out of the Q4 mandate like `/stories/en/`.
- ~~**A new GA4 event** — reuses `whatsapp_click` via `js/wa-track.js` ([ADR 0006](../decisions/0006-ga4-carries-whatsapp-click-tier-separation-console-side.md)).~~
  **`share_click` added at the PR 2 kickoff** ([ADR 0057](../decisions/0057-ga4-carries-share-click-for-happening-landing-pages.md)); still no Meta Pixel event for shares.

## Schema, RLS, permissions
New file `supabase/schema/58_events_public.sql` (the spine in `40_events.sql` stays as is):

- `events.events` gains: `slug` (unique where not null, URL key), `title_he`, `title_ar`,
  `summary_he`, `summary_ar`, `body_he`, `body_ar`, `image_paths text[]` (ordered, [0] = cover,
  ≤ 8, each path format-checked through the immutable `events.valid_image_paths()`), `story_slug` (a /stories/
  pair; a slug, not a URL, so no page can be pointed at an arbitrary link),
  `recur_weekdays smallint[]` (0–6, null = dated), `recur_until date`. Format CHECKs on
  `slug`, `story_slug` and every gallery path. Existing public rows that cannot meet the new rule
  are demoted to internal by the file (with a notice) before the CHECKs are added.
- **CHECK** `events_public_bilingual`: `visibility = 'public'` ⇒ `slug`, both titles, both
  summaries and — unless the item links a story pair — both bodies non-empty (invariant 5 in the DB).
- **CHECK** `events_public_not_quote`: `visibility = 'public'` ⇒ `source_module` is not
  `quotes` — defends the customer-PII rule beyond the projector's own default.
- **Staff read tightened:** `events_events_select` now also requires `quotes.view` for
  quote-sourced rows. Found at build time: exposing the schema would otherwise let every staff
  account (which holds `events.view`) read customer names through the API.
- `recur_weekdays` values 0–6, `recur_until >= event_date`.
- **`events.feed` rewritten** to the live rule and the public columns only: public ∧ confirmed/
  in_progress ∧ (dated: `event_date >= today` in `Asia/Jerusalem`; recurring: `recur_until` null
  or `>= today`), with a computed `next_date`. Anon **column** grants extended to exactly the new
  public columns; `notes`, `owner_id` and `source_*` stay unreachable. *(Correction at the PR 2
  gate, 2026-09-29: the internal `title` has been anon-readable since 40 and both views select
  it; the form writes the Hebrew title into it and a quote-sourced row can never be public, so
  nothing beyond the public text is exposed — the sentence, not the grant, was wrong.)*
- **Storage:** bucket `events-public` (public read); insert/update/delete on `storage.objects`
  gated by `core.has_permission('events.manage')`; image types only, size cap (pattern from
  `50_storage.sql`).
- **Permissions:** none new — `events.manage` (owner + manager) publishes, `events.view` reads
  internally. The `events` module row flips `enabled = true` (launcher tile).
- **API exposure:** add `events` to `config.toml` `schemas` and to the prod + staging dashboard
  "Exposed schemas" list (hand step, named in PR 1; the grant audit covers the grants).
- **`rls_matrix.sql` gains** (24 assertions): the feed hides a past item and computes a
  recurring item's next date in Jerusalem; anon cannot read `owner_id`/`source_module`, create
  an event, or upload; staff cannot see quote-sourced events, write events or upload; manager
  can publish bilingual items (and a story-linked one without a body), cannot publish without
  Arabic or a slug, cannot make a quote event public, cannot set a bad slug / image path /
  weekday; the storage policies never reach `quotes-docs`. *The live rule lives in the feed
  view, not in RLS: a past public item is still public, just no longer listed.*

## UI surface
- **`/app/events`** (new module folder `app-src/src/modules/events/`): list (upcoming / recurring /
  unpublished, `.rowline`), form with HE and AR fields side by side on desktop, stacked on phone;
  dated/recurring toggle; weekday chips; photo gallery (equal tiles, cover mark, remove ✕); save is
  always allowed and the form says what publishing still needs — the message re-words itself as
  fields fill and disappears when they are complete (the DB check is the real gate). Module i18n
  dictionary HE + AR.
- **`/happening/` + `/happening/ar/`** (committed shells with an `<!--ITEM_LIST-->` marker, filled
  by the generator into `_site/` and refreshed on load — see "Generation"): cards with
  photo, title, next date/time, summary → the item's landing page. ~~Detail page
  `/happening/item/?e=<slug>` rendered in the browser~~ → **since the PR 2 kickoff: a generated
  static landing page per item**, `/happening/<slug>/` + `/happening/ar/<slug>/`, see "PR 2 — the
  landing pages"; `js/happening.js` hydrates it from `events.feed` on load.
- **Homepage:** ~~a 3-card strip +~~ nav link only (strip removed 2026-09-29); `index.html` + `js/app.js` dictionary keys HE + AR.
- **Step zero screenshots** at 360 / 390 / 1280 for: the admin form (HE + AR), the list page and a
  detail page in both languages ~~, the homepage strip~~.

## Prod apply checklist (PR 1) — from the gate's security review, 2026-09-28

Exposing the `events` schema makes whatever prod *actually* holds on `events.*` reachable for the
first time, and the grant audit does not see column-level grants (ADR 0005). In this order:

1. **Before anything:** on prod, read and record `select attname, attacl from pg_attribute where
   attrelid = 'events.events'::regclass and attacl is not null`, `select polname, polcmd, pg_get_expr(polqual, polrelid)
   from pg_policy where polrelid in ('events.events'::regclass, 'events.tasks'::regclass)`, and
   `select relname, relrowsecurity from pg_class where oid in ('events.events'::regclass, 'events.tasks'::regclass)`.
   Also count public rows: `select visibility, source_module, count(*) from events.events group by 1, 2`.
2. Hand-apply `58_events_public.sql` (it demotes non-publishable public rows and reports how many).
3. Re-run step 1's queries and diff them against the local stack: anon may read exactly the 20 public
   columns (never `notes`, `owner_id`, `source_*`); RLS on for both tables; the select + public +
   insert/update/delete policies; trigger `events_events_guard_source` present (`pg_trigger`); bucket
   `events-public` public with its size/type limits and exactly the four `events_public_*` policies on
   `storage.objects`. **Any extra anon/public grant found here is revoked before step 5** (and the
   revoke added to the schema files, so the audit keeps it).
   Also `select enabled, label from core.modules where key = 'events'` → `true`, `'מה קורה'` (58 only
   flips the row from 40's exact seed state; a differently-labelled prod row would stay disabled).
4. `node supabase/tests/audit-grants.mjs --ref <prod>` → 0 drift.
5. **Only then** add `events` to Settings → API → Exposed schemas; probe as anon: `/rest/v1/feed`
   (Accept-Profile: events) answers, `/rest/v1/events?select=notes` answers 42501.
6. Deploy the function: `supabase functions deploy translate --no-verify-jwt --project-ref <ref>` and
   `supabase secrets set --project-ref <ref> GOOGLE_TRANSLATE_API_KEY=…` (staging first, then prod).
   On staging, press "תרגום מעברית" once right after deploying: a 411 means the cloud gateway drops
   Content-Length and the function's body-size gate needs a byte-limited reader instead.

### Prod apply record — 2026-09-28
Done through the management API, owner's go-ahead in the session. Before: exactly 40's state
(15 columns, 9 anon column grants, 3 policies, module disabled under 'יומן ואירועים', no bucket),
19 internal quote-sourced rows, no public rows. After 58: the ten comparisons against local all
match (20 anon columns, 7 policies, 2 triggers, 12 constraints, bucket, 4 storage policies, 7
functions with their ACLs, `feed`, the module row enabled as 'מה קורה'); row counts unchanged;
`audit-grants` 0 drift / 0 undeclared. `events` added to the exposed schemas; anon probes with
the live publishable key: `feed` 200 `[]`, `notes` / `owner_id` / `source_module` / `next_date`
42501. `translate` deployed (`--no-verify-jwt --use-api`), key set; anonymous POST 401, preflight
for levyam.com 200. Left for the owner: press translate once on prod after the merge.

**Gotcha paid for:** `supabase secrets set --env-file supabase/functions/.env` uploads *every*
variable in the file, so prod also received the local OTEL_* values (environment name `local`).
`OTEL_ENVIRONMENT`, the endpoint and the revision were restored in the session;
`OTEL_EXPORTER_OTLP_HEADERS` (the ingest token) must be re-set by the owner per the README's
telemetry section. Set one secret with an explicit `NAME=value`, never with `--env-file`.

## Rollback
Unpublish every item (`visibility = 'internal'`) — the hubs and each item page's
load-time check show the empty/unavailable state within seconds; the generated item HTML itself
stays on levyam.com until the next successful rebuild lands (the `rebuild-site` trigger, the prod
nightly, or a manual `workflow_dispatch` of `deploy.yml` if the trigger is what broke). Full
rollback: revert PR 2 (pages, generator, workflows, nav), then PR 1's UI; the added
columns are nullable and can stay; the bucket is emptied by hand.

## Checks
- **Roadmap:** Phase 2 — 2026-Q4 mandate item 8; current block. ✔
- **Architecture:** (1) RLS on `events.events` + storage policies, column grants for anon ✔
  (2) anon key only in the browser ✔ (3) no PII public — CHECK forbids quote-sourced public rows;
  photos are the owner's choice, no names of residents in text (ADR 0053 rule carried over) ✔
  (4) bilingual + recurrence rules as CHECKs ✔ (5) HE + AR, enforced by CHECK ✔ (6) visibility
  flag already on the table, default `public` = P4 ✔ (7) no live tool replaced ✔ (8) roadmap
  updated ✔. Spine: extends the `events` spine instead of a new table ✔. **Verdict: aligned.**
- **Vision:** serves P4 (public by default — "see what's happening") and the Join circle; built so
  Phase 3 initiatives feed the same table (P1). Does not break P6 — event rows carry no money.
  **Verdict: aligned.**
- **PR 2 re-check (2026-09-28):** *Architecture* — (1) the rebuild token is scoped to Actions on
  one repo and held server-side in an Edge Function that re-checks `events.manage`; the browser
  never sees it ✔ (2) the generator uses the anon key and the same column grants as the browser,
  so it cannot read what the public may not ✔ (3) the two new fields join the bilingual CHECK;
  `events.passed` exposes the same public columns only ✔ (5) HE + AR pages, the Arabic CTA text
  gets a native reader's pass ✔ (6) `visibility` still the only switch; a rebuild is triggered, never
  a write from GitHub to the DB ✔ ARCHITECTURE §6c: `main` stays branch-protected — the token
  cannot push; a dispatch on a foreign ref is stopped by the `github.ref` job guard and, for prod,
  by the `github-pages` environment's `main`-only deployment-branch policy ✔. A new coupling to record in ARCHITECTURE at close-out:
  **the marketing deploy now depends on the platform project at build time** (feed fetch fails the
  build). *Vision* — P4 (public by default) now reaches the share sheet; the "Path to booking"
  keeps Phase 4's "act on it" for the 2027-01-01 review, so the Q4 mandate (ADR 0046) is
  unchanged. **Verdict: aligned; one ARCHITECTURE amendment due at close-out.**
- **Positioning tension (ADR 0046, "private & business events"):** resolved by the owner at
  kickoff — this page is the *public life* of the venue (weekends, community, initiatives); the
  private/business story stays on the homepage and stories. Recorded in ADR 0054.

## Open questions
- ~~*(logged at the gate, 2026-09-28, security review of the form round)* `events.valid_image_paths`
  accepts any `<uuid>/` prefix, so a row written by hand (not via the form) could reference and
  then, on removal, delete another item's object. Not an escalation — the bucket's delete policy is
  bucket-wide for `events.manage` — but pass `id` into the helper (`p like id::text || '/%'`) with
  the next schema change so two rows can never share an object.~~ **Closed by
  `59_events_landing.sql` (PR 2): the helper takes the row's `id`; `rls_matrix` asserts a path
  under another item's id is refused.**
- *(same review)* `friendlyError`'s fallback shows raw PostgREST text (table/constraint names, no
  data) for unmapped errors, e.g. an RLS refusal. Pre-existing; map the RLS message to
  `errNotWritten` and fall back to a generic bilingual line when the module doc is written.
- *(logged at the gate, 2026-09-28)* `events.tasks` is readable with `events.view` alone, so staff
  without `quotes.view` could see task rows of quote events they can no longer see. Empty today
  (quotes' checklists still live in quotes); must be closed when checklists migrate into
  `events.tasks` (Phase 2 internal half) — same `quotes.view` rule via the parent event.
**Blocking — none.** Non-blocking (decided in the build, reported at the PR):
1. **Staging/prod Supabase URL for the static site** — `js/happening.js` needs the platform
   project's URL + anon key per tier; the staging build must swap them (`build-site.sh`). The
   marketing site has never talked to the platform project before.
2. ~~**Per-item sitemap entries**~~ — resolved at the PR 2 kickoff: the generator writes them.
3. **Photo rules** — max size and whether faces of guests are allowed; default: owner's judgment,
   no resident names in captions.

## Decisions made on the way
- 2026-09-29 · **PR 2, the owner's localhost review** (before the gate; [ADR 0058](../decisions/0058-initiatives-stand-alone-cost-booking-fields-section-named-yozmot.md)) —
  the owner walked the built page on localhost and reworked it in short iterations:
  - **The section is "יוזמות" / "مبادرات"** (nav on every page, hub title, strip, breadcrumbs,
    404, `llms.txt`); the URL and the code keep `happening`.
  - **No connection between initiatives and stories:** `story_slug` dropped, the body required
    for every public item (`60_events_cost.sql`, the `publishable()` story clause removed);
    the "read the full story" link and the form's field are gone.
  - **Cost + booking** (`cost_he/ar`, `booking_required`) entered at creation, shown as one
    tile ("עלות והרשמה") — the same both-or-neither CHECK; `translate` covers the cost text.
  - **The page:** the full site header + zigzag instead of the minimal header; an action panel
    (CTA + share row as round icon buttons) beside the fact tiles on desktop, one shape for
    every box; tiles with the brand's marks (sun / house / logo stamp / heart / palm), "מתי"
    without the next date (the hero carries it), "איפה" on two lines; the photos as an
    automatic 3-second crossfade (blur-in, slow zoom; arrows, dots, swipe, keys; pauses on
    hover, hidden tab, off-screen; no autoplay under reduced motion); "יוזמות נוספות" last,
    three across on desktop; drive-time boxes, the accessibility line, the about photos and
    the second about paragraph removed; the about text is the owner's; the sticky CTA carries
    the WhatsApp icon and tucks away while the panel is on screen; desktop column 1120px.
  - **The hub:** a month calendar (browser-rendered from the feed, recurring items expanded,
    nothing before today marked, opens on the first month with something) with the day's
    items beside it; the owner's standfirst; a uniform responsive card grid (no featured card).
  - The Arabic header nav overlapped its social icons at 1280px on every page since the seventh
    nav item: the compact nav size now holds until 1366px for Arabic (`css/styles.css`).
  - Deferred (owner's call): a passed item still shows its CTA (dateless) under the banner;
    the hero stays the cover photo, not a slideshow.
  - **The homepage strip is out** (owner, on the staging round): initiatives appear only under
    `/happening/`; the homepage keeps the nav entry and loads none of the happening scripts.
- 2026-09-29 · **PR 2 gate** (simplify → code-review + security-review as subagents):
  - **An item's text can never fail a deploy:** the template engine substitutes in one pass and
    checks for stray placeholders on the template only, so `{{…}}` in a title renders literally
    (both reviews found the old order made a hostile or careless row fail every prod deploy).
  - **JSON-LD is JSON-escaped:** `<` → `\u003c` in both blocks (covers `</script`, `<!--<script`
    and `<script`); the breadcrumb block is built by the generator instead of HTML-escaped in the
    template.
  - **CI order:** `qrcode` loads only on a render, so `gen-happening --check` runs before `npm ci`.
  - **A passed item's CTA carries no date** (the next occurrence only) — it keeps the button (Q8)
    but does not ask to come on a date that is over.
  - **`misconfigured`** (500) when the token is set but the workflow/ref secrets are malformed —
    the form says the rebuild failed, not "not set up here".
  - **Pre-merge order made explicit:** 59 is hand-applied on prod *before* the merge — the prod
    deploy fetches `events.passed` and fails closed until it exists.
  - Follow-ups (not this PR): `LevYamTrack.onWhatsAppClick`'s matcher should skip the numberless
    share link so landing pages can share `js/stories.js`'s handler; lists could select card
    columns only; merged remote branches predating the `github.ref` guards should be deleted
    (a raw token holder could dispatch their old workflow files onto staging — noindex, bounded).
- 2026-09-28 · **PR 2 build** (from the decisions table, no re-asking):
  - **Nav label:** "מה קורה" / "شو في" — the module's own name (PR 1, seen by the owner), placed
    after "סיפורים" in every nav (homepage, story chrome, hubs). The owner can rename it in one
    place per surface (`js/app.js` keys `nav_happening*`, the two story templates). Flagged at
    the PR: it sits near the older "מה קורה בלב ים" (services) entry.
  - **One renderer, two runtimes:** `js/happening-render.js` is a dependency-free UMD script —
    the browser (hubs, landing pages; the strip until 2026-09-29) and `scripts/gen-happening.mjs` (Node,
    `createRequire`) render a card, a date line, the CTA text and the share text from the same
    functions, so a page built at deploy and a page refreshed on load can never differ.
  - **Per-tier feed config is a file, not a build-time substitution:** `js/happening-config.js`
    holds the local stack in the checkout (ADR 0004 — local never touches prod; the prod anon
    key is not in the repo, only in the `VITE_*` secrets) and is rewritten into `_site/` from
    the env by the generator. The hubs and the landing pages read it (the homepage no longer loads it).
  - **Chrome stamping is shared:** `scripts/lib/chrome.mjs` (extracted from
    `gen-stories-index.mjs`, one implementation) stamps story chrome and happening chrome; a
    fourth chrome var `HAPPENING_CURRENT` marks the happening hub's nav entry.
  - **The fixture may carry absolute image paths** (`/img/gallery/…`) so CI and local
    screenshots render real photos; the renderer serves an absolute path as-is and prefixes a
    bucket path. The DB never produces an absolute path (`events_image_paths_valid`).
  - **JSON-LD date-times carry the Asia/Jerusalem offset** for their date (IST/IDT, computed
    with `Intl`), recurring items get `eventSchedule`; a passed page has no `Event` JSON-LD
    (it is `noindex`). Never `offers`.
  - **The AR CTA/share wording** (`أهلًا، بحب أجي على <الاسم> بتاريخ <التاريخ>`,
    `الجاي:` for the next occurrence) and the AR landing texts reuse the reviewed phrasing of
    `/stories/ar/how-to-get-to-jisr-az-zarqa/` and `js/app.js`; **the CTA line still needs the
    native reader's pass before merge** (decisions table, Q6).
  - **Found in step zero:** an author `display: grid` beats the UA's `[hidden]` rule — the
    facts card needed an explicit `[hidden] { display: none }`; and the local functions'
    origin allow-list has `localhost:5173`, not `127.0.0.1:5173` (a `rebuild_failed` note in
    dev is that, not the function).
- 2026-09-28 · **PR 2 kickoff** (11 closed-form questions + the owner's booking addition): a
  generated static landing page per item, rebuilt on publish through a scoped GitHub token; share
  row + sticky bar; two optional fields; `share_click` in GA4; story pairs no longer required;
  one Tier-A PR · [ADR 0056](../decisions/0056-whats-happening-item-pages-are-generated-landing-pages-rebuilt-on-publish.md),
  [ADR 0057](../decisions/0057-ga4-carries-share-click-for-happening-landing-pages.md)
- 2026-09-28 · Owner's staging review: the save error must go away once fixed → the form's checks
  run live (shown after the first save attempt, `role="status"`), a server answer is kept only
  while the form is unchanged since that attempt, and the fields freeze while a request is in
  flight (gate finding: an edit made meanwhile hid the answer). Gallery redone as equal tiles.
  `.error-box` added to the shell CSS as the shared save-error box.
- 2026-09-28 · Staging apply: `supabase secrets set` also uploads everything under `config.toml`'s
  `[edge_runtime.secrets]`, so a local-only `TRANSLATE_FAKE` landed on staging (inert: a real key
  wins). Removed there; the no-key echo is now decided by the function's own URL (local stack only)
  and the config section is kept empty with a warning.
- 2026-09-28 · Gate (code review): kept `events.visibility default 'public'` although an insert that
  omits visibility now fails the bilingual CHECK — "public by default" is vision principle 4, the
  failure is loud (never a silent leak), and every writer (form, quotes projector) sets it explicitly.
  Raised to the owner at the gate summary; **owner confirmed 2026-09-28: keep `'public'`.**
- 2026-09-28 · Gate (security review): 40's `FOR ALL` write policy split into insert/update/delete
  (FOR ALL also grants SELECT, OR'd with the tightened read policy) + trigger `events.guard_source`:
  only a projecting module sets or clears `source_module`/`source_id`.
- 2026-09-25 · Build: `page_url` became `story_slug` (a slug can't carry a `javascript:` link
  onto a public page); `published_at` dropped (unused); the list and the form translate the
  item text by UI language with fallback. **Gallery (owner, step zero 2026-09-26):** one photo →
  up to 8, first = cover; `image_path` became `image_paths text[]` before 58 was applied
  anywhere but local. Local-dev fix found in step zero:
  `[auth.email] enable_signup = false` in `config.toml` (2026-08-12) disabled email *login*
  on every local stack restart — set back to `true`; signup stays closed by `[auth]`.
- 2026-09-25 · Scope widened from the mandate's "minimal: events table + one page" to an admin
  form, detail pages, recurring items, nav + homepage strip, photos, JSON-LD and per-item
  WhatsApp text; the page shows public life, not private events · [ADR 0054](../decisions/0054-whats-happening-is-db-driven-public-life-bilingual-in-the-db.md)

## Close-out
*PR 1 merged 2026-09-28 (#93, on prod). PR 2 built 2026-09-28 — this section is written at the
PR; the merge date and the outcome-check date are filled in at merge.*

**What shipped (PR 2, Tier A):**
- `supabase/schema/59_events_landing.sql`: `audience_he/ar`, `bring_he/ar` (+ CHECK
  `events_public_optional_bilingual`), `events.feed` with the four columns + anon column grants,
  `events.passed` (90-day window, anon + authenticated select), `events.valid_image_paths(id,
  paths)` pinned to the row's id. `rls_matrix.sql` +13 assertions (green locally). Baseline
  regenerated. **Prod: hand-applied after the staging round, then `audit-grants --ref` → 0 drift**
  (owner setup step 4).
- `supabase/schema/60_events_cost.sql` (the owner's localhost review, ADR 0058): `cost_he/ar`
  + `booking_required`; the both-or-neither CHECK covers cost; `story_slug` and its CHECK
  dropped, `events.publishable()` without the story clause (body required), both views
  recreated. `rls_matrix.sql`: +3 assertions, the story-link case inverted. Baseline
  regenerated. **Staging + prod: hand-applied like 59 (steps 0 and 4).**
- `supabase/functions/rebuild-site`: signed-in + `events.manage` re-checked, dispatches
  `REBUILD_WORKFLOW` on `REBUILD_REF` with `GITHUB_DISPATCH_TOKEN` (fixed result codes only);
  `not_configured` without the token. `translate` gains the two optional fields.
- `/app/events`: the two optional lines and the cost pair + booking switch (HE/AR paired,
  translate covers them, live check for the both-or-neither rule); the story-link field is gone; every save that changes public state, the publish/unpublish toggle
  and a delete of a public item call `rebuild-site` and show what it answered; the list's link
  column is the landing page URL.
- The public surface: `happening/_item.html` + `_item.ar.html` (landing templates),
  `happening/index.html` + `ar/index.html` (served hub shells, chrome-stamped),
  `happening/_fixture.json`, `scripts/gen-happening.mjs` (stamp / check / render / fixture),
  `scripts/lib/chrome.mjs`, `js/happening-render.js`, `js/happening.js`,
  `js/happening-config.js`, `css/happening.css`; `js/wa-track.js` `shareClick` (ADR 0057);
  homepage nav entry (`index.html`, `js/app.js`; the strip shipped and was removed on the
  staging round, 2026-09-29 — the homepage carries no initiatives), nav entry in both story templates
  (every story page re-stamped); `404.html` routes `/happening/*` to the hub of its language;
  `llms.txt` section; `sitemap.xml` entries at deploy.
- Delivery: `assemble-site.sh` copies `happening/`, runs the generator, purges `_*` under
  `_site/happening`; `deploy.yml` nightly schedule + `github.ref` guards on both jobs + feed env
  on the assemble step + `/happening/` smoke checks; `deploy-staging.yml` `github.ref` guard;
  `ci.yml` chrome `--check` + fixture render. `supabase/README.md` documents the three secrets
  and the token's honest scope; `CLAUDE.md` gains the What's-happening conventions and the
  second GA4 event; ARCHITECTURE §6c records the build-time coupling.

**Verified locally (gate step zero + /verify):** screenshots at 360/390/1280 of the HE + AR
landing page (hero, CTA + share row, facts, body, gallery, next-3, getting-here, about, footer,
sticky bar, QR panel), the passed and unavailable load-time states against the real local feed,
both hubs, the homepage nav in HE and AR (no strip), the `/app/events` list and form; `rebuild-site`
answered `not_configured` to the owner, `forbidden` to staff, `origin_not_allowed` to a foreign
origin; `RLS MATRIX: ALL ASSERTIONS PASSED`; lint / typecheck / tests / both generators' `--check`
/ the fixture render green.

**Left out / pending:** the owner's setup (PAT + three secrets per project, function deploy,
hand-apply 59 + 60 on prod) — listed above under "Owner setup"; the native reader's pass on the AR
CTA line, the section name "مبادرات" and the about paragraph; `og:image` is the cover at its stored size (≤1600px), not a 1200-wide render
(Supabase image transforms are a paid feature). Not built, by decision: a practical-answers
block, a contact block, a village block, booking (Phase 4, "Path to booking").

**Alignment:** VISION — P4 (public by default) now reaches the share sheet and the WhatsApp
preview; the Q4 mandate (ADR 0046) is unchanged. ARCHITECTURE — every invariant re-checked in
the PR 2 re-check above holds; the one new coupling (build-time read of the platform project)
is recorded in §6c. **Verdict: aligned.**

## Outcome check
*(appended on the check date: metric value vs target, verdict, what it changes)*
