# Lev Yam Platform — Roadmap

The path from today's platform to the [vision](VISION.md). Ordered by **value and
dependency** (steady pace, no external deadline). Tick tasks as they complete; each work
session should start by reading this file (the `session-start` skill) and end by updating it.

**How we work:** one phase = one or more feature branches off `main`; verify against the
**local Supabase stack** (`supabase start && supabase db reset`, then `cd app-src && npm run dev`;
static pages via `python3 -m http.server 8080`) — and, for prod-like checks, the **staging tier**
(`lev-yam-staging` / staging.levyam.com) — before pushing. `main` still deploys straight to prod.
DB changes go through `supabase/schema/*.sql` (source of truth) plus the generated baseline that
local `supabase db reset` applies — staging and prod are applied by hand, never pushed
([ADR 0061](decisions/0061-staging-schema-applied-by-hand-never-db-push.md); `supabase/tests/build-baseline.mjs`; see
[plans/platform-staging-environment.md](plans/platform-staging-environment.md)). A live tool is
replaced only after its successor earns cut-over on real service days (as POS did, 2026-07-15).
**Blocks:** the *current block* is the first `## ` section with an unticked **top-level** item
whose heading carries none of ✅ (closed), the word *deferred*, or *parallel track*; indented
sub-items never make a block current; a block opened at a quarterly review links its mandate in
its lead paragraph (none linked → none to cite). Unticked lines left in a closed block are parked
or blocked, except a list the block labels *ordinary items* (indented under that label), which
stays actionable. A *parallel track* is a lane, not a block — one of its unticked lines counts as
current work only when the line itself carries no fold (→), no *optional* or *out of* marker, and
no date beyond the quarter. The skills cite this rule by name (**Blocks**) and never restate it
([ADR 0062](decisions/0062-instruction-files-state-rules-never-state-sessions-open-with-session-start.md)).

**History is one line per item.** The detail of everything shipped lives in its plan file's
close-out and the decision log; this file keeps the link, not the story
([ADR 0065](decisions/0065-roadmap-consolidated-q4-mandate-merged-to-five-lines.md)).

---

## Shipped — Phase 0 to the Operating-system block ✅ (2026-07 → 2026-09-22)

- [x] **Phase 0 — platform foundation:** `/app` shell, Supabase auth + passkeys, RBAC via
      `core.has_permission()`, users admin, finance entries + report
- [x] **i18n layer** (HE + Levantine Arabic, RTL) in the app shell *(2026-07-08)*
- [x] **Quotes manager joins the platform** *(2026-07-09)* — [plans/quotes-module.md](plans/quotes-module.md);
      the old local app is archived read-only and never copied here
- [x] **Module template** — [MODULE-TEMPLATE.md](MODULE-TEMPLATE.md) *(2026-07-09, kept current)*
- [x] **Cross-module spines** (events, money, preparation) *(2026-07-09/10)* —
      [plans/cross-module-foundation.md](plans/cross-module-foundation.md)
- [x] **Finance UX pass** *(2026-07-13, PR #6)* — [plans/finance-ux-pass.md](plans/finance-ux-pass.md)
- [x] **Finance books integrity** — categories as data, reconciliation, owner override, transfers
      *(2026-08-03/05)* — [plans/finance-books-integrity.md](plans/finance-books-integrity.md)
- [x] **POS migration + cut-over** — billing, kitchen, day report, permissions, parity trial,
      `pos.html` → `/app/pos` *(2026-07-15)* — [plans/pos-module.md](plans/pos-module.md),
      [plans/pos-cutover-hardening.md](plans/pos-cutover-hardening.md)
- [x] **POS operations v2** — kitchen visibility, summary + expenses, split payments, menu-as-data
      + options + menu admin, day lifecycle *(2026-07-21 → 07-30)* —
      [plans/pos-operations-v2.md](plans/pos-operations-v2.md), [plans/pos-menu-kitchen.md](plans/pos-menu-kitchen.md)
- [x] **Platform hardening H1–H8** — RLS matrix, local migration pipeline, permission governance,
      initplan sweep, invites, user lifecycle, `finance.expected` guard, Bluebox tracing, hygiene
      batch — [plans/platform-hardening.md](plans/platform-hardening.md),
      [plans/bluebox-observability.md](plans/bluebox-observability.md)
- [x] **Users suite + UX pass** *(2026-07-16, 07-20)* — [plans/users-permissions-suite.md](plans/users-permissions-suite.md),
      [plans/users-ux-admin-caps.md](plans/users-ux-admin-caps.md)
- [x] **Mobile-UX foundation** *(2026-07-12)* — [plans/platform-mobile-ux.md](plans/platform-mobile-ux.md)
- [x] **Staging environment** — local stack + `lev-yam-staging` + staging.levyam.com *(2026-07-28)* —
      [plans/platform-staging-environment.md](plans/platform-staging-environment.md)
- [x] **Prod privilege escalation closed + live grant audit on every deploy** *(2026-08-05/12)* —
      [plans/phase1-closeout.md](plans/phase1-closeout.md); partial payments, topbar overflow,
      `disable_signup`, break-glass account invited
- [x] **Operating system** — branch protection, decision log, risk tiers, tests + lint, product
      skills, automations on the subscription token, cadence *(closed reduced 2026-09-22,
      [ADR 0044](decisions/0044-adr-0040-confirmed-and-part-4-reduced-closure.md))* —
      [plans/master-execution-plan.md](plans/master-execution-plan.md)
- [x] **Marketing site Phase 0** — `/stories/` section, sitemap + hub generator, `robots.txt`,
      `llms.txt`, `/facts.txt`, `EventVenue` JSON-LD, GA4 `whatsapp_click` —
      [plans/content-engine-phase0.md](plans/content-engine-phase0.md)
- Follow-ups — **ordinary items**, grouped by the PR they ship in:
  - [ ] **Instruction-file hygiene** (one Tier-A PR; it touches `.github/workflows/`, so staging
        verification applies) — **before the 2026-11-01 monthly run:**
        (a) the close-out ritual in CLAUDE.md also says "update `docs/modules/<module>.md`";
        (b) `quarterly-review/evidence-pack.md` names ADR 0041 as the live deferral — now 0045;
        (c) `monthly-triage.yml` and `quarterly-prep.yml` still assert present state (ADR 0062);
        (d) the production-context step + its CLAUDE.md standing rule (H9 P5, needs no Dynatrace)
  - [ ] **Edge functions in CI** (one Tier-A PR) — `deno check` over `supabase/functions/` in
        `ci.yml`; a rate limit on passkey `login/options` (pre-auth amplification vector)
  - [ ] **Observability docs carve-outs** (one docs-only PR) — H9.5-F query-hygiene rules; H9.5-A's
        deployment-marker note correction

## Phase 2 — 2026-Q4 mandate: the marketing quarter (first quarterly review, 2026-09-22)

*The mandate and the owner's words behind it: [ADR 0046](decisions/0046-q4-2026-mandate-marketing-quarter.md);
merged on 2026-10-07 ([ADR 0065](decisions/0065-roadmap-consolidated-q4-mandate-merged-to-five-lines.md)),
extended and **put in the owner's order** the same day
([ADR 0066](decisions/0066-q4-mandate-order-content-media-first-items-16-to-18.md)), then **renumbered
to match the order** ([ADR 0067](decisions/0067-q4-mandate-renumbered-to-the-order.md)) — the number *is*
the rank; *(was N)* is the number used in documents dated before the renumbering (mapping below).
Positioning for every piece: **"Focus on private and business events — we want a lot of focus on the
venue and what it gives to people."** Each line is its own
initiative through `feature-spec` with an Outcome metric and a check date (ADR 0019); one spec per
session. Items 1, 2 and 5 start without item 7 and gain GBP / Instagram / Facebook when it lands.*

- [ ] **1. Content & media optimization** *(was 18; owner, 2026-10-07)* — everything published on every
      channel is accurate, current and keeps getting new material:
      (a) one source of truth per kind — facts `FACTS.md`, photos a Google Drive folder the owner fills
      from the phone → `media/` → optimized, video `video/` + the hero, live activity `/app/events`;
      (b) a one-time inventory of what is live on every channel, with a fix list;
      (c) freshness rules (owner sets the numbers) — zero fact mismatches, new GBP photos weekly, gallery
      monthly, story facts re-checked every 90 days, hero video quarterly, nothing expired visible;
      (d) the photo/video pipeline — weekly sort, pick, optimize per channel, owner approves; guests'
      faces only with consent, never names;
      (e) the weekly routine — an automated cross-channel check plus the owner's ~20–30 min list with
      drafts ready, and a monthly deeper audit
      → *channels in sync with `FACTS.md`; days since the last photo / video / post per channel; photos
      added per week*. Site + Drive first; GBP and social join with item 7
- [ ] **2. Weekly marketing report** *(was 17; owner, 2026-10-07)* — its own weekly issue **and** an
      email to the owner: traffic, `whatsapp_click` per page, the AI-citation log, outcome checks due,
      item 1's freshness numbers, and **social publishing** *(was 6, then under 15)*: a reel a week and
      a post per story, tracked against the cadence. The engineering weekly drops its Analytics headline
      and links here. Social / GBP numbers reach the agent as a file from a fixed pre-agent step, never as
      a credential (ADR 0047/0048 pattern); the email needs its own scoped send credential — Tier A,
      security review. → *reports delivered weekly; the social cadence met*
- [ ] **3. Search & AI visibility** *(was 3 + 4)* — the same facts everywhere (site,
      GBP, socials), `facts.txt` / `llms.txt` expansion, internal links between stories, the local
      queries the story backlog does not cover → *local-pack impressions, direction requests, AI-answer
      citations* (the manual citation check of ADR 0052 until a paid source is decided)
- [ ] **4. Story pages** *(was 2)* — **the pair cadence runs in parallel with everything above until
      2026-10-24** (16 pairs, by hand — [ADR 0052](decisions/0052-stories-four-pairs-a-week-for-the-first-month.md));
      position 4 is its next phase: CTA sharpening and the pace after 24 Oct. Narrative essays, one village
      story each, facts into `FACTS.md` first ([ADR 0053](decisions/0053-story-pages-are-narrative-essays-village-facts-sourced-in-facts.md),
      [0063](decisions/0063-every-story-page-tells-a-village-story-no-other-page-tells.md)) → *organic sessions
      and `whatsapp_click` by `page_slug`*. [plans/stories-authoring-tool.md](plans/stories-authoring-tool.md);
      **5 of 16 live**; check date 2026-10-25. Open `FACTS.md` gaps: a typical weekend's events, the
      Israel Trail segment, Nimer's fishing calendar (backlog topics 8, 14, 15)
  - [ ] **CTA sharpening** *(was 5)* — the sticky WhatsApp bar on stories (reuse יוזמות' `.hp-sticky`),
        each page's prefilled message checked → *click-through rate per page*
  - [ ] **Content automation** *(was 11)* — `@claude` drafts a pair from a brief issue; on hold
        while pairs are written by hand (owner, 2026-10-07)
  - [ ] Bug: desktop header nav overlaps the social icons at 961–1300px, site-wide, HE + AR — Tier B,
        needs a design call (measurements in the plan's follow-ups)
  - [ ] Script the extra-figure and video-montage steps (`story-images.sh --as`, `scripts/story-video.sh`) — Tier A
- [ ] **5. Google Business Profile loop** *(was 7)* — posts, photos, review replies, Q&A; `AggregateRating`
      on site; the owner's weekly part lives in item 1's list; by hand until item 7 lands →
      *GBP calls and direction requests*
- [ ] **6. Backlink programme** *(was 9)* — tourism, food/travel, Arab-society media; the owner's outreach,
      Claude drafts → *referring domains*
- [ ] **7. Connect social + GBP to Claude** *(was 16; owner, 2026-10-07)* — read + draft, the owner
      publishes; the owner authorizes the connector in claude.ai (Windsor.ai the candidate — coverage
      checked at kickoff); connectors live in the owner's sessions only, never in the automated agents;
      **UTM on every owned link** (GBP website button, Instagram / Facebook bios, shares) so those visits
      stop landing as "direct" → *GBP / social numbers readable every week*
- [ ] **8. Paid test** *(was 10)* — a small Meta/Google campaign against one or two pages → *cost per WhatsApp
      conversation*. **Prerequisite (owner, 2026-09-22):** prove the paid path end to end before
      spending — UTM on every ad URL, the campaign landing in GA4 as `Paid Social` / `Paid Search`,
      Meta Pixel `Contact` firing, `whatsapp_click` attributable by `page_slug` *and* source. (A
      campaign that stopped inside the 2026-09-22 window showed up as a drop nothing could cost.)
- **Done this quarter:**
  - [x] **Analytics wiring** *(was 1; shipped 2026-09-22, PR #73)* — [plans/marketing-analytics-wiring.md](plans/marketing-analytics-wiring.md);
        Ahrefs/Semrush parked as a spend decision ([ADR 0047](decisions/0047-analytics-wiring-ga4-and-gsc-only-public-numbers.md)).
        **Outcome check due 2026-10-19**
  - [x] **Public "What's happening" / יוזמות** *(was 8; shipped 2026-09-30, PRs #93 + #97)* —
        [plans/events-whats-happening.md](plans/events-whats-happening.md), ADRs 0054–0059.
        **Outcome check due 2026-10-21.** Follow-ups: [modules/events.md](modules/events.md)
  - [x] **Take the public write off the report agents** *(was 14; 2026-09-22,
        [ADR 0048](decisions/0048-report-agents-hold-no-write-and-actions-are-sha-pinned.md))*
  - [x] **Video pipeline (Remotion)** *(was 15; built 2026-10-06, PR #109)* — [plans/video-pipeline.md](plans/video-pipeline.md),
        [ADR 0064](decisions/0064-video-is-made-with-remotion-in-the-repo-guidelines-are-the-leash-refreshed-weekly-by-pr.md);
        check date 2026-11-10 (4 reels posted — tracked in item 2)
    - [ ] A render smoke in `ci.yml` when `video/` changes — Tier A
    - [ ] Re-lay out the two existing reels to the Meta safe zone
    - [ ] Arabic native-reader pass on the weekend copy; owner sets the `/app/events` weekend item to
          the FACTS hours (blocks the first post); the `VIDEO_GUIDELINES_PAT` secret
- **Old → new numbers** (references dated before 2026-10-07 use the old ones): 18 → 1 · 17 → 2 ·
  3, 4 → 3 · 2, 5, 11 → 4 · 7 → 5 · 9 → 6 · 16 → 7 · 10 → 8 · 6 → 2 · 12, 13 → [ideas.md](ideas.md) ·
  done: 1 analytics, 8 What's happening, 14 report agents, 15 video pipeline (ADR 0065–0067).
- **Out this quarter:** English stories (`/stories/en/`) — reserved in the URL structure, not built.

## Parked until a trigger *(deferred)*

*Each line names what un-parks it. None is current work.*

- [ ] **Put prod and staging on the migration pipeline** — trigger: the three prerequisites, in order:
      (1) a real schema diff proving the tier matches the baseline, (2) `supabase migration repair
      --status applied` to stamp it without executing, (3) DB connectivity from CI. Never `db push`
      before then ([ADR 0005](decisions/0005-prod-schema-verified-by-live-grant-audit.md),
      [ADR 0061](decisions/0061-staging-schema-applied-by-hand-never-db-push.md)); the grant audit is
      the check that runs meanwhile
- [ ] **Server-side provenance resolution** — trigger: the first surface *outside* finance needs
      entry → quote/POS links, or a fifth in-module consumer. Shape: a `security_invoker`
      `finance.entries_resolved` view ([plans/phase1-closeout.md](plans/phase1-closeout.md))
- [ ] **PITR (Supabase paid tier)** — trigger: 20 signed contracts ([ADR 0002](decisions/0002-pitr-deferred-until-20-signed-contracts.md))
- [ ] **Make `js/app.js` metadata translation opt-in** — trigger: a second page loads `app.js`
      (it overwrites `document.title` + four meta tags through hardcoded selectors; it is why
      `/stories/` has `js/stories.js`)
- [ ] *(Optional)* **Self-hosted Arabic webfont** — trigger: the system stack looks wrong next to
      Hebrew now that whole pages are Arabic (a deliberate design today, not a bug)
- Module-level open items stay in their logs: [finance](modules/finance.md) (the reversed-cash
  `by_payment` column), [users](modules/users.md) (bilingual `core.modules` / `core.permissions`
  labels), [events](modules/events.md), [pos](modules/pos.md), [quotes](modules/quotes.md)

## The 2027-01-01 quarterly review — deferred decisions

*The authoritative list is [ADR 0045's re-check list](decisions/0045-observability-home-re-deferred-to-2027-01-review.md#the-2027-01-01-re-check-list)
(extended by ADR 0065); `quarterly-prep` finds it by the ADR's Status line. Summarised here so
nothing deferred is invisible:*

- **The observability home** — and everything parked on it: Operating-system Steps 4, 7, 8; the
  Dynatrace halves of 9, 10, 11 (reconciliation-as-monitor alert, log-attribute fix, traceparent
  linking, SRG + SDLC events, dashboards-as-code, the Dynatrace MCP entry); the **dead Dynatrace RUM
  tag** on the marketing site (404 since 2026-09-09 — [ADR 0038](decisions/0038-new-dedicated-dynatrace-environment.md))
- **`@simplewebauthn/server`** `^10.0.0` → latest — bump with a passkey re-test on staging, or defer again
- **Credentials, one session:** regenerate `CLAUDE_CODE_OAUTH_TOKEN`, rotate `GOOGLE_SA_KEY`, delete
  the unused `ANTHROPIC_API_KEY` secret (expires 2027-01-31 anyway)
- **Break-glass account** — confirm it can sign in (email confirmed); owner action, any time before
- **Skill evals** — the first real run of every `.claude/skills/*/EVALS.md`, done before the review

## Phase 2 — What's happening: bookings & events *(internal half deferred by the Q4 mandate)*

*Replaces WhatsApp-thread reservation tracking. The shared calendar itself is the `events`
spine landed in Phase 1 ([plans/cross-module-foundation.md](plans/cross-module-foundation.md))
— this phase builds the bookings module **on** it. **2026-09-22:** the public "What's happening"
half moved up into the Q4 mandate (its item 8 before the renumbering; shipped 2026-09-30); the rest waits for the
2027-01-01 review ([ADR 0046](decisions/0046-q4-2026-mandate-marketing-quarter.md)).*

- [ ] `41_bookings.sql`: reservations table (RLS, permission keys) feeding the `events`
      spine; spine events already carry the **visibility flag — `public` by default,
      `internal` opt-out** (anon RLS reads published events only)
- [ ] Bookings module: day/week calendar, reservation CRUD (party size, contact, notes, status)
- [ ] Events management: community events, workshops, hosted dinners (title, time, capacity,
      owner) — designed so Phase 3 initiatives create these same events
- [ ] Confirmed quote events surface in the same calendar — the projection trigger +
      backfill land with the Phase 1 spine; here: verify in the calendar UI and migrate
      quotes prep checklists (jsonb) into `events.tasks`, then retire the column
- [ ] "Happening" feed v1 on the launcher: today's reservations + upcoming events —
      the first taste of *see what's happening*

## Phase 3 — Community creation (the heart of the dream)

*Members propose ideas and bring them to life inside the app. An initiative is a generic
container for **any** dream (fishing trip, workshop, festival, tour…) — no hardcoded
categories.*

- [ ] New role: **member** (community), created **by team invitation only** for now
      (staff invite people they know; opening a public request → approve flow is Phase 6).
      *Prerequisite: the H5 invite + password-reset flows (timing = plan Q3) — members
      must onboard without anyone opening the Supabase dashboard*
- [ ] `50_initiatives.sql` + Initiatives module: **propose → approve → run** (any member
      proposes; the Lev Yam team approves before it goes live)
- [ ] Initiative workspace: description, team, tasks/next-steps, its own events
      (flowing into the Phase 2 calendar and, when public, the levyam.com feed)
- [ ] Initiative **budget & expenses tied to finance from day one** — with **per-initiative
      access control**: only that initiative's lead(s) + finance-permission holders see its
      money. This needs row-level, per-initiative grants (finer than role → module → action) —
      design the RLS model carefully before any UI
- [ ] Activity feed v2: venue life + initiative updates in one stream; public items flow to
      levyam.com, internal ones stay behind login
- [ ] Onboard the first real community members and run 1–2 real initiatives through it

## Phase 4 — Open the doors: transactions from outside

*The public already sees what's happening (Phase 2); now they can act on it. Everything here
is bilingual HE/AR like the marketing site.*

- [ ] Online booking on levyam.com → bookings module (anon insert with verification via an
      edge function; WhatsApp stays as a parallel channel)
- [ ] Event signup/tickets on the public "What's happening" feed (capacity, confirmation) —
      the path is written: [plans/events-whats-happening.md](plans/events-whats-happening.md) "Path to
      booking" (owner, 2026-09-28); PR 2 builds the landing page's CTA as one swappable block
- [ ] Digital menu (QR at the table) — read-only first, sourced from POS items
- [ ] Table ordering → POS kitchen pipeline (only after the QR menu is proven)
- [ ] Notifications channel (WhatsApp/email confirmations) — needed once booking goes public

## Phase 5 — Deep operations

- [ ] Staff & shifts module: scheduling on top of users/roles, hours overview
- [ ] Inventory & suppliers: stock, purchasing → finance expenses, linked to POS menu items
- [ ] Dashboards v2: consolidated P&L (POS + quotes + finance), trends over time,
      per-initiative views

## Phase 6 — Community & loyalty

- [ ] Returning-guest recognition (from bookings + POS history)
- [ ] **Open the membership door:** public request → approve flow on levyam.com — membership
      grows beyond team invitations (revisits the Phase 3 invite-only decision)
- [ ] Social-impact storytelling: real numbers from the platform feeding the marketing site

---

## Cross-cutting foundations (touched in every phase)

- **Module template** (created in Phase 1, improved after): keep "new module" a ~1-hour task
- **Bilingual everywhere:** HE + Levantine Arabic from Phase 1, internal and public alike —
  the i18n layer lands with the first module and nothing is retrofitted
- **Public by default:** feed/calendar content is visible on levyam.com unless marked
  internal — every content table carries a visibility flag from its first migration
- **Mobile-first:** staff and members work from phones — test there first
- **RLS is the guard — and it's tested, not just written** (from Phase 1.5): every new
  table gets policies before UI; the regression suite runs after every schema apply and
  a new module adds its can/can't assertions with its policies; `lib/permissions.ts`
  mirrors the seeded keys. Money data is the strictest: initiative finance uses
  per-initiative grants, never platform-wide visibility
- **This file is the tracker:** update checkboxes and add discovered tasks each session
