# 0056 — A "What's happening" item is a generated static landing page, rebuilt when it is published, and built to be shared

- **Date:** 2026-09-28
- **Status:** accepted. It amends [0054](0054-whats-happening-is-db-driven-public-life-bilingual-in-the-db.md) §3 (the written story pair is no longer a requirement) and §4 (the detail page becomes a landing page; "live within seconds" becomes "live within minutes").
- **Decided by:** owner (PR 2 kickoff, [plans/events-whats-happening.md](../plans/events-whats-happening.md) "PR 2 — the landing pages")
- **Source:** owner, 2026-09-28: *"I want those pages to be very easy to share through whatsapp or different ways through links. The pages should be like a real cool landing page that is providing the full information of the event and relevant information about lev yam."* Eleven closed-form questions followed; the answers are the plan's decisions table.

## Context

PR 1 shipped the data and the `/app/events` form. The plan's public surface was a static shell
filled in the browser from `events.feed`, at `/happening/item/?e=<slug>`. Once sharing became the
requirement, that design failed at its first step: WhatsApp, Facebook, Telegram and iMessage build a
link's preview from the page's `og:title` / `og:description` / `og:image` **without running
JavaScript**, so every shared item would have previewed as the same generic "מה קורה" card. The
item's own title and photo have to be in the HTML the crawler fetches. Production is GitHub Pages
behind GoDaddy DNS, so a request-time worker was not an option without moving the domain.

## Decision

1. **A static page per item per language is generated at deploy** from `events.feed` into the
   build output only (`/happening/<slug>/`, `/happening/ar/<slug>/`, reciprocal `hreflang`, per-item
   `og:*`, `Event` JSON-LD without `offers`, per-item `sitemap.xml` entries). The generated pages
   are never committed: the items are not known at commit time.
2. **Publishing triggers the rebuild.** A new Edge Function, `rebuild-site`, re-checks
   `events.manage` and dispatches the tier's deploy workflow through GitHub's API with a
   **fine-grained token scoped to this one repository and to Actions read/write only** — it can
   dispatch, re-run, cancel or delete runs of this repo's workflows on any ref; it cannot push code,
   read secrets or change settings. A `github.ref` guard on each deploy job (`main` for prod,
   `staging` for staging; it covers a ref once that ref carries it, and it lets the nightly schedule
   and the dispatch through since both run on `main`) and the `github-pages` environment's
   `main`-only branch policy — the one guard that does not depend on the ref — are what keep a
   dispatch from publishing anything but the tier's own branch; staging's bounded exposure is a
   stale branch on a noindex tier. A nightly scheduled deploy
   **on prod only** retires passed items (a schedule runs from the default branch, so it would
   overwrite staging's branch under verification). An item is live within minutes, still with no
   PR and no agent.
3. **The page is a landing page, immersive and in the brand:** full-bleed hero, the item's text,
   gallery, the next three live items, "where and how to get here", "about Lev Yam", the standard
   footer. Every venue fact comes from `FACTS.md`. Not included: a practical-answers block, a
   separate contact block, a village block.
4. **Sharing is built in:** WhatsApp share, copy link, the native share sheet and a print QR,
   under the hero and in a sticky bar on phones. The WhatsApp CTA is prefilled per item
   (`שלום, אשמח להגיע ל<שם> ב<תאריך>`, AR twin in Levantine).
5. **Two optional structured fields** per item, HE + AR: "who it's for" and "what to bring /
   meeting point". The database refuses a public row that fills one language and not the other.
6. **An expired link never dead-ends** for 90 days: the page stays, `noindex`, says the item has
   passed and shows what is coming up.
7. **The landing page replaces the written story pair** for the big recurring items; `story_slug`
   is an optional "read the full story" link.
8. **The CTA is one swappable block**, so a Phase 4 booking form can take its place; the plan
   carries a written "Path to booking". Nothing booking-related enters the schema now.
9. **One Tier-A PR**, the owner's choice over a two-PR split.

## Consequences

- The marketing deploy now reads the platform's Supabase project at build time, and a feed
  fetch failure fails the build on purpose: a site whose shared links 404 is worse than a
  delayed deploy.
- A GitHub token lives as a Supabase secret for the first time. Its blast radius is this
  repository's workflow runs (dispatch, re-run, cancel, delete, on any ref) and nothing in the
  code, secrets or settings; the `github.ref` job guards and the prod environment's branch policy
  are what bound what it can publish. Secrets are set one at a time — `--env-file` uploads
  everything (2026-09-28, plan gotcha).
- `59_events_landing.sql` is a schema change hand-applied to prod with a before/after record, as 58 was.
- `deploy.yml` gains a nightly schedule (staging does not); a passed or unpublished item's page
  is served until the next rebuild, and the page's own load-time check covers that window.
- Sharing is measured: Dynatrace `levyam.share` and, by exception to ADR 0006, GA4 `share_click`
  ([0057](0057-ga4-carries-share-click-for-happening-landing-pages.md)).
