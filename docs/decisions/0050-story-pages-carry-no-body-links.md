# 0050 — Story pages carry no links in the body text

- **Date:** 2026-09-23
- **Status:** accepted — amends the "2–3 internal links" rule of the `story-author` skill and
  [plans/stories-authoring-tool.md](../plans/stories-authoring-tool.md)
- **Decided by:** owner (localhost review of the first cornerstone pair, `team-day-by-the-sea`)
- **Source:** owner's review of the draft on localhost, 2026-09-23

## Context

The story-author skill asked for two or three internal links inside the body text — an SEO
habit (link equity, crawl paths) carried over after template revision 1 removed the related-links
block. The first real page put three of them in its last paragraph, pointing at homepage
sections (`/#why`, `/#services`, `/#faq`). Reviewing it, the owner found them unintuitive:
"it is not intuitive to move between pages" — a reader mid-page is sent to a different page's
anchor with no sense of where they will land.

## Decision

Story pages carry **no links in the body text**. The ways onward are the site header nav
(generated chrome) and the page's WhatsApp CTA. This applies to every story page, not just the
first one.

## Consequences

- The skill drops the rule and the "read titles for internal links" step; the plan's
  acceptance list is amended in place with a pointer here.
- Crawl paths to story pages rest on the hubs, `sitemap.xml` and the header nav — all
  generated, so nothing is lost for discovery; internal link equity between stories is given up
  deliberately.
- Revisit if Search Console shows story pages failing to get indexed, or if a later page
  genuinely needs a cross-reference (e.g. the directions page) — then decide the form (a
  closing line, a card) as its own decision, not a body link by default.
