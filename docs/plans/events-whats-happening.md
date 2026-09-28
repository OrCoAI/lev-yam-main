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
| Metric | (1) GA4 `whatsapp_click` with `page_slug` = `happening` or `happening-*`; (2) GA4 sessions landing on `/happening/*` (HE + AR); (3) Search Console impressions for `/happening/*` URLs |
| Source | GA4 Data API + Search Console — the weekly-review analytics snapshot ([ADR 0047](../decisions/0047-analytics-wiring-ga4-and-gsc-only-public-numbers.md)) |
| Baseline (today) | 0 / 0 / 0 — the pages do not exist (2026-09-25) |
| Target | clicks ≥ 10 in the first 21 days; visits and impressions are a first read (reported, no pass line) |
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
- **PR 2 — public surface:** `/happening/` pages + `js/happening.js`, homepage strip, nav link in
  both `_template*.html` + generator, JSON-LD, prefilled WhatsApp, `assemble-site.sh` allowlist,
  `sitemap.xml` (the two hub URLs), `llms.txt` line.

- **Owner setup for the button:** a Google Cloud project with the Cloud Translation API enabled
  and billing on, an API key restricted to that API, then `supabase secrets set
  GOOGLE_TRANSLATE_API_KEY=…` on staging and prod. Until then the button answers "not configured".

## Explicitly out of scope
- **Member-proposed initiatives** (propose → approve → run) — Phase 3. The owner's "initiatives"
  here are items the *team* publishes; Phase 3 initiatives will project into the same table.
- **Signup / tickets / capacity booking** — Phase 4; the CTA is WhatsApp only.
- **The internal bookings calendar / reservation CRUD** — the deferred internal half of Phase 2.
- **Prices** — never, anywhere (FACTS rule); no `offers` in JSON-LD.
- **Past events archive** — the owner chose "only what is live".
- **Per-item URLs in `sitemap.xml`** — DB items are not known at build time; v1 lists the two
  hubs only (see open question 2).
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
  photo, title, next date/time, summary → detail. Detail page `/happening/item/?e=<slug>` and
  `/happening/ar/item/?e=<slug>`, rendered by `js/happening.js` (anon key, fetch against
  `events.feed`); canonical + `hreflang` + JSON-LD injected on render; `noindex` on "not found".
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
2. **Per-item sitemap entries** — a deploy-time step could query published items into
   `sitemap.xml`; deferred until the first outcome read shows whether detail pages are found.
3. **Photo rules** — max size and whether faces of guests are allowed; default: owner's judgment,
   no resident names in captions.

## Decisions made on the way
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
