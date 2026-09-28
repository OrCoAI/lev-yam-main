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
| Baseline (today) | 0 / 0 / 0 — the pages do not exist (2026-09-25) |
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
     within seconds, no PR.
   - **Big path — a static story-style page** for the major recurring items, written through the
     `story-author` flow as an HE + AR pair. The DB item then carries that pair's `story_slug` and
     the list links there instead of the generated detail page.
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
  `rebuild-site` function + nightly schedule, `59_events_landing.sql` (two optional fields,
  `events.passed`), share row + `share_click`, homepage strip, nav link in both `_template*.html`
  + generator, JSON-LD, prefilled WhatsApp, `assemble-site.sh`, per-item `sitemap.xml` entries,
  `llms.txt` line.

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
| 11 | Homepage strip + nav link | **Both in.** |
| + | Booking system (owner's addition on Q6) | **A "Path to booking" section in this plan, and hooks in the build:** the CTA is one swappable block; nothing booking-related enters the schema now. Roadmap Phase 4 links here. |
| — | Delivery | **One PR, Tier A** (owner's choice over a 2a/2b split). |

### How it works

**Generation.** `scripts/gen-happening.mjs <tier>` runs inside `scripts/assemble-site.sh` after the
static copy. It reads the platform project's URL + anon key from the environment (prod: the
`VITE_SUPABASE_*` secrets already on `deploy.yml`; staging: the hard-coded staging values in
`deploy-staging.yml`; local: the local stack), fetches `events.feed` and `events.passed`
(anon REST, the same column grants the browser has) and renders, from `happening/_item.html` /
`_item.ar.html`, one page per item per language into **`_site/` only** — never into the checkout,
because the items are not known at commit time and `ci.yml --check` would otherwise always be
stale. It also appends the live items' URLs (both languages, reciprocal `hreflang`) to
`_site/sitemap.xml`. A feed fetch failure **fails the build** — a site whose shared links 404 is
worse than a delayed deploy; a re-run fixes it. `ci.yml` runs the renderer against a committed
fixture (`--fixture`, no network) so the templates are tested on every PR. The generator stamps
the `chrome:footer` region of the happening templates and hubs the way `gen-stories-index.mjs`
stamps story chrome (ADR 0049), so a footer change stays one edit per language.

**Rebuild trigger.** New Edge Function `rebuild-site`: signed-in caller, `events.manage`
re-checked server-side, then `POST /repos/OrCoAI/lev-yam-main/actions/workflows/<workflow>/dispatches`
with `{ ref }`. Secrets per project, set one by one (`supabase secrets set NAME=value`, never
`--env-file`): `GITHUB_DISPATCH_TOKEN` — a **fine-grained PAT scoped to this one repository with
Actions: read + write only** (it can start or cancel a run; it cannot push code, read secrets or
change settings), 1-year expiry noted in `supabase/README.md`; `REBUILD_WORKFLOW`
(`deploy.yml` / `deploy-staging.yml`); `REBUILD_REF` (`main` / `staging`). Local dev answers
`not_configured`. The form calls it after any save that changes public state (publish, unpublish,
edit of a public item) and shows "העמוד הציבורי יתעדכן תוך כמה דקות". Repeated calls collapse
into the workflow's own `concurrency` group. Telemetry: fixed result codes only (ADR 0013).
**Nightly rebuild:** both deploy workflows gain `schedule: cron '30 22 * * *'` (00:30 / 01:30
Jerusalem) so a passed item leaves the sitemap and flips to its passed state without anyone
publishing. Same rails as the report jobs (ADR 0039 spirit): a scoped token, a workflow that only
rebuilds, no agent.

**Expired state.** `events.passed` is a second anon-readable view: public items whose last
occurrence passed within the last 90 days, same public columns. The generator renders them with
`noindex`, a "האירוע הזה כבר עבר" banner, the next-3 block and the CTA, and leaves them out of
the sitemap. After 90 days the page is gone and `404.html` routes `/happening/*` to
`/happening/`. Every generated page also checks the feed on load: an item that passed since the
last rebuild flips to the passed state at once, and text/gallery edits show without waiting.

**The page** (HE and AR, one URL each, `hreflang`, `canonical`, `og:title` = item title,
`og:description` = summary, `og:image` = cover at 1200-wide, `Event` JSON-LD with
`eventSchedule` for recurring items, `location` = Place with FACTS' coordinates, no `offers`):
1. **Hero** — cover photo full-bleed, title, when (next date + time, recurrence line), summary;
   WhatsApp CTA (prefilled) + share row (WhatsApp · copy · share · QR).
2. **Who it's for / what to bring** — labelled lines, only when filled.
3. **Full text** (`body_*`), then a "read the full story" link when `story_slug` is set.
4. **Gallery** — swipeable, the same image set as the form (cover first).
5. **Also coming up** — the next 3 other live items (rendered at build, refreshed on load).
6. **Where & how to get here** — Waze "לב ים", Google Maps by coordinates, drive times from
   Tel Aviv / Haifa / Caesarea / Hadera, "parking at the entrance", the partial-accessibility
   line. Car only; public transport is unverified in FACTS and is not written.
7. **About Lev Yam** — 2–3 lines from FACTS §זהות + 2–3 venue photos from the existing gallery.
8. **Standard site footer.**
On phones a **sticky bottom bar** keeps the CTA and share reachable. The QR is rendered at build
time as inline SVG (the `qrcode` package as an `app-src` devDependency — already installed before
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

**Homepage strip + nav.** `index.html`: a "מה קורה" strip (next 3 items, rendered in the browser
from the feed — the homepage is not per-item) + a nav entry linking `/happening/`; dictionary keys
HE + AR in `js/app.js`. Story chrome: the same nav entry in `_template.html` / `_template.ar.html`
(one generator run stamps every story page).

**Owner setup (before staging sign-off):**
1. GitHub → Settings → Developer settings → Fine-grained tokens → *Generate new token*: resource
   owner `OrCoAI`, **only** repository `lev-yam-main`, repository permissions **Actions: Read and
   write**, nothing else, expiry 1 year. Copy it once.
2. `supabase secrets set --project-ref vhvghcehkcbtygomixmu GITHUB_DISPATCH_TOKEN=<token>`, then
   `REBUILD_WORKFLOW=deploy-staging.yml`, `REBUILD_REF=staging` (three separate commands). Prod:
   `--project-ref teyxtdccsrkdpqnbfcga`, `REBUILD_WORKFLOW=deploy.yml`, `REBUILD_REF=main`.
3. `supabase functions deploy rebuild-site --no-verify-jwt --use-api --project-ref <ref>`.
4. Hand-apply `59_events_landing.sql` on prod after the staging round, then `audit-grants` → 0 drift.

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
  requirement; `story_slug` is an optional link (ADR 0056).
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
- **A new GA4 event** — reuses `whatsapp_click` via `js/wa-track.js` ([ADR 0006](../decisions/0006-ga4-carries-whatsapp-click-tier-separation-console-side.md)).

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
  public columns; `notes`, `owner_id`, `source_*`, and the internal `title` stay unreachable.
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
- **`/happening/` + `/happening/ar/`** (static HTML shells, no build, like `stories/`): cards with
  photo, title, next date/time, summary → the item's landing page. ~~Detail page
  `/happening/item/?e=<slug>` rendered in the browser~~ → **since the PR 2 kickoff: a generated
  static landing page per item**, `/happening/<slug>/` + `/happening/ar/<slug>/`, see "PR 2 — the
  landing pages"; `js/happening.js` hydrates it from `events.feed` on load.
- **Homepage:** a 3-card strip + nav link; `index.html` + `js/app.js` dictionary keys HE + AR.
- **Step zero screenshots** at 360 / 390 / 1280 for: the admin form (HE + AR), the list page and a
  detail page in both languages, the homepage strip.

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
Unpublish every item (`visibility = 'internal'`) — the public pages render empty-state within
seconds with no deploy. Full rollback: revert PR 2 (pages, nav, strip), then PR 1's UI; the added
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
  a write from GitHub to the DB ✔ ARCHITECTURE §6c: `main` stays branch-protected — the dispatch
  builds `main` as it is, it cannot change it ✔. A new coupling to record in ARCHITECTURE at close-out:
  **the marketing deploy now depends on the platform project at build time** (feed fetch fails the
  build). *Vision* — P4 (public by default) now reaches the share sheet; the "Path to booking"
  keeps Phase 4's "act on it" for the 2027-01-01 review, so the Q4 mandate (ADR 0046) is
  unchanged. **Verdict: aligned; one ARCHITECTURE amendment due at close-out.**
- **Positioning tension (ADR 0046, "private & business events"):** resolved by the owner at
  kickoff — this page is the *public life* of the venue (weekends, community, initiatives); the
  private/business story stays on the homepage and stories. Recorded in ADR 0054.

## Open questions
- *(logged at the gate, 2026-09-28, security review of the form round)* `events.valid_image_paths`
  accepts any `<uuid>/` prefix, so a row written by hand (not via the form) could reference and
  then, on removal, delete another item's object. Not an escalation — the bucket's delete policy is
  bucket-wide for `events.manage` — but pass `id` into the helper (`p like id::text || '/%'`) with
  the next schema change so two rows can never share an object.
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
*(appended when done — CLAUDE.md "Roadmap item close-out")*

## Outcome check
*(appended on the check date: metric value vs target, verdict, what it changes)*
