---
name: story-author
description: >
  Write one /stories/ page pair (Hebrew + Levantine Arabic twin) from a short brief, ready for
  the owner's review PR: facts only from FACTS.md with [חסר]/[مفقود] markers and a gap list,
  every template placeholder filled, three optimized images from the media/ intake folder, hub
  and sitemap regenerated. Triggers: "write a story", "new story page", "story about", "draft
  the page for", "סיפור חדש". Not for editing the homepage or the platform.
metadata:
  version: '0.1.0'
---

# Story author

Turns a brief into a reviewable story pair. The owner is the publishing gate (tone + facts);
this skill never commits, pushes or publishes. Plan: `docs/plans/stories-authoring-tool.md`;
the rules are `CLAUDE.md` (Stories), the RULES block in `stories/_template.html`, ADR 0007 and
ADR 0049.

## Input — the brief

One paragraph from the owner: topic, the target query in Hebrew as people actually type it,
the intent (booking / directions / story / seasonal), and optionally a byline or a person to
quote. If the target query is missing, ask for it — one closed question — before writing.

## Procedure

1. **Read, don't recall:** `FACTS.md` in full, `stories/_template.html`,
   `stories/_template.ar.html`, and every existing `stories/<slug>/index.html` title (to
   refuse a near-duplicate — one page, one query cluster).
2. **Slug:** English kebab-case, shared by both twins (`stories/<slug>/`, `stories/ar/<slug>/`).
   Refuse a slug that already exists.
3. **Hebrew draft** from `_template.html`, every `{{PLACEHOLDER}}` replaced. The RULES block at
   the top of the template is the rule set (facts, no prices, answer-first, meta limits, FAQ ↔
   JSON-LD identical, every figure in the one 16:9 frame); this skill adds only:
   - H1 carries the target query. Body length and voice per the template RULES (ADR 0053), real names and places where `FACTS.md`
     has them (unless it says a name stays off the pages), no marketing generics. FAQ 3–5 Q&As. **No links in the body text** — the
     page is read top to bottom, and a link out of it mid-paragraph is not where a reader expects
     to go next (ADR 0050). The site nav and the WhatsApp CTA are the ways onward.
   - A missing fact becomes `[חסר: what is needed]` in the text, never a guess.
   - **Research (ADR 0053):** a new village fact enters `FACTS.md` §"הכפר" — source URL,
     confidence per the file's legend, verification date — **before** a page uses it; בינוני
     facts are hedged ("לפי…", "כ־"). Sensitive facts go on a page only with the owner's
     approval and only as `FACTS.md` states them — no added detail; the 1948 sentence verbatim —
     the approved list is ADR 0053 §4 (1948
     and the neighbours; the 1924–26 move to the ridge; the entrance under the coastal highway);
     anything else sensitive is raised first. Residents and other businesses are never named
     without the owner's and Nimer's OK; a quote appears only as its cited source has it, never
     attributed to Nimer. No invented scenes, no unverified quotes.
   - `levyam:published` = today; canonical, the three `hreflang` links and `og:image` carry
     the slug.
   - CTA lead and the URL-encoded WhatsApp message are page-specific and mention the topic.
   - The figure needs a **landscape image at least 1600px wide** (`/img/{{IMAGE_PATH}}`); the
     frame crops it to 16:9. Pick one from `img/gallery/` (`08`, `09`, `10`, `14`, `18` are
     1600×1200) or delete the whole
     `<figure>` — the generator refuses a page that references a missing image.
   - Leave the chrome regions (between the `chrome:header` / `chrome:footer` markers) exactly
     as the template has them — the generator stamps them.
4. **Arabic twin** from `_template.ar.html`: Levantine Arabic drafted from the approved Hebrew,
   same facts, same slug, same images, `[مفقود: …]` wherever the Hebrew has `[חסר: …]`. Not a
   word-for-word translation — natural phrasing for a reader in Jisr az-Zarqa and the north.
5. **Photos:** list `media/` (subfolders by subject) plus the five 1600×1200 gallery files, and
   propose 1–2 candidates for the hero; the owner picks. Then
   `scripts/story-images.sh <photo> <slug> [--focus top|center|bottom]` writes the three
   derivatives under `img/stories/<slug>/` (sizes in `media/README.md`), rotation applied,
   metadata stripped. It refuses a source under 1600×900; if nothing fits, stop with a named
   photo request. A second photo or a video montage is not scripted yet — the first pair's
   by-hand recipe is in `docs/plans/stories-authoring-tool.md` (Status, 2026-09-23).
6. **Generate:** `node scripts/gen-stories-index.mjs` — stamps chrome, rebuilds both hubs and
   `sitemap.xml`, and fails on a missing twin, a stale canonical, a leftover placeholder, a
   referenced image that does not exist, or an `og:image` that is not the slug's `card.jpg`.
7. **Gap list — the hand-off.** Reply with: the two file paths, every `[חסר]` item as a
   numbered list of questions for the owner (mark which need Nimer), and the photo used. Then
   run the `verify` skill on `/stories/<slug>/` and `/stories/ar/<slug>/` (static serve +
   screenshots at 360 / 390 / 1280 with the overflow report) before handing over — that is
   the gate's step zero. The owner answers the gaps in session; the
   answers go into `FACTS.md` (same PR) and the markers are replaced. **A page with a marker
   left in it does not go to PR.**
8. The PR waits for a native reader's sign-off on the Arabic (owner / Nimer) before merge.
   Tier C for a pages-only pair, B when it adds to `FACTS.md`; declare in the PR.

## Never

The template's RULES block and `CLAUDE.md` (Stories) hold the standing rules. On top of them:
- Two pages for the same query cluster.
- Editing `stories/index.html`, `stories/ar/index.html`, `sitemap.xml` or a chrome region by
  hand — generated.
- Committing, pushing, or requesting indexing — the owner does.
