# 0053 — Story pages are narrative essays; researched village facts enter FACTS.md with sources first

- **Date:** 2026-09-24
- **Status:** accepted — amends the content standard in [plans/stories-authoring-tool.md](../plans/stories-authoring-tool.md)
  (scope item 1: answer-first, 250–500 words) and the `story-author` skill; extends `FACTS.md`'s
  sourced-public-facts pattern (fishing seasons) to the village's history, nature and culture.
- **Decided by:** owner (session of pairs 2–4, before their PRs)
- **Source:** owner, 2026-09-24 — "I want that all of the stories … will be more in a story tone …
  research relevant information and stories about this unique village from historical perspective
  and cultural pov and include the facts with the storytelling so each one of the stories will be
  unique and story-oriented."

## Context

The first pair (live) and the next three (drafted) were written answer-first and fact-dense —
250–500 words of venue facts in `FACTS.md` order. They answer the query; they read as a brochure.
The owner wants each page to be a story. Three written rules stood in the way, and each needed a
call: `FACTS.md` is the only fact source and had nothing about the village's history; the plan's
word count; and the answer-first lede, which is the SEO/AEO mandate (ADR 0046, ADR 0052).

## Decision

1. **Voice: a narrative essay.** Each page tells **one** true story of the place, tied to its
   query, in the third person, with the venue facts woven in. No invented scenes, no unverified
   quotes, no composite anecdotes. Residents and other businesses in the village are not named
   without the owner's and Nimer's explicit approval (the village's well-covered fisherwoman
   stays off the pages — owner, 2026-09-24).
2. **The lede stays answer-first.** Sentences 1–2 fully answer the query; the story starts at
   sentence 3. Google and the AI answer engines keep an extractable answer; the reader gets the
   story right after it.
3. **Length: 400–700 words** (was 250–500). Room for one story arc without padding; still a
   phone read, paced by the 16:9 figures and the video.
4. **Research goes into `FACTS.md` first.** Village facts from public sources enter
   `FACTS.md` §"הכפר — היסטוריה, טבע ותרבות" with the source URL, a confidence level per the
   file's legend (גבוה = a primary or official source, two independent sources, or the owner's
   on-site confirmation; בינוני = one secondary source) and the verification date; a page
   uses only what is there, phrased to the confidence ("לפי…", "כ־"). Sensitive facts go on a
   page only with the owner's approval and only as `FACTS.md` states them (no added detail; the
   1948 sentence verbatim); the approval list lives here, not in the served file — approved 2026-09-24: why the
   village remained in 1948 (its neighbours' labour ties), the 1920s move from the marsh to the
   ridge, and the road entrance under the coastal highway. Not approved: naming residents.
5. **Personal material comes later.** Anecdotes from Or and Nimer (how Lev Yam started, the
   family's fishing story) are wanted but not now (owner, 2026-09-24); no `[חסר]` markers are
   held open for them. They arrive as `FACTS.md` entries verified with Nimer, then as edits.
6. **Applies to every story page, live ones included.** `team-day-by-the-sea` is rewritten in
   place: same URL, `levyam:published` kept, `levyam:updated` bumped.

## Consequences

- The HE template's RULES block carries the voice and length rule; the skill, the AR template
  and the plan point to it. `FACTS.md`'s legend carries the sourcing rule.
- `FACTS.md` grows a sourced village section (~50 facts: the name, the stream and its
  crocodiles, the Roman water works for Caesarea, the marsh and the 1920s move, 1948, the
  fishermen's village and its methods, the way in, hospitality). Later backlog pages — the
  entity page (#12), things to do (#13), the trail (#14), fishing seasons (#16) — draw from it.
- Research is a step of the skill, not a one-off: a new fact means a `FACTS.md` entry with a
  source before it appears on a page. The confidence tag governs the phrasing.
- Rewriting a live page changes it inside its outcome window. The 2026-10-25 check reads
  Search Console per URL; the URL is kept and the rewrite date is noted in the plan.
- Pages are ~450–500 words instead of ~250: the Arabic review per pair takes longer.
