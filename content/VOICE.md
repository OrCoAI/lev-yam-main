# VOICE — how Lev Yam writes

The writing rules that have no other home, and links to the ones that do. Every content skill
reads this after [`README.md`](README.md). Amended only by a PR the owner merges — the monthly
audit proposes, it never applies (the plan's "What makes it evolve" §1).

## Rules that live elsewhere — read them there

| Rule | Home |
|---|---|
| Every fact comes from `FACTS.md`; anything else is `[חסר: …]` / `[مفقود: …]` | [`FACTS.md`](../FACTS.md) header |
| **No prices, ever** — cost is "free" / "ببلاش" or "by WhatsApp" | CLAUDE.md, [`video/GUIDELINES.md`](../video/GUIDELINES.md) §1.2 |
| The village's name and its meaning: always "ג'סר א-זרקא" — "הגשר הכחול" in FACTS' exact wording | [`FACTS.md`](../FACTS.md) §הכפר |
| Residents, guests, staff and other businesses are never named; a review quote is "אורחת" / "ضيفة" | [ADR 0053](../docs/decisions/0053-story-pages-are-narrative-essays-village-facts-sourced-in-facts.md) §1, GUIDELINES §1.1 |
| A sentence attributed to Nimer is verified by him first | the plan's Roles table |
| Story pages: narrative essays, answer-first, one village story never told twice | [ADR 0053](../docs/decisions/0053-story-pages-are-narrative-essays-village-facts-sourced-in-facts.md), [ADR 0063](../docs/decisions/0063-every-story-page-tells-a-village-story-no-other-page-tells.md) |
| Every post speaks to one audience and ends in that audience's one action | [ADR 0070](../docs/decisions/0070-content-themes-are-audiences-business-first-the-place-is-the-setting-of-every-post.md) |
| Every public Arabic text is signed off by the owner before it is posted | [ADR 0069](../docs/decisions/0069-every-published-piece-is-built-from-ids-and-recorded-content-records-additive-never-load-bearing.md) §7 |
| Reels: hooks, on-screen text, RTL typography | [`video/GUIDELINES.md`](../video/GUIDELINES.md) §4, §7 |

## The positioning every piece carries

*"Focus on private and business events — we want a lot of focus on the venue and what it gives to
people"* ([ADR 0046](../docs/decisions/0046-q4-2026-mandate-marketing-quarter.md)). The village, the
sea and the kitchen are the **setting** of every post, never its subject alone (ADR 0070 §3).

## Hebrew

- Warm, direct, present tense; short sentences a phone reads in one breath. "אתם" for the reader.
- Concrete over adjectives: what happens, where you sit, what you eat, what you see — not
  "חוויה ייחודית" or "מקום קסום".
- The name is **לב ים**, never translated, never with a sub-brand.

## Arabic

- **Levantine colloquial as spoken in Jisr az-Zarqa and the north** — the register the story
  pages already use (`بيلعبوا`, `شختورة`, `وراها`), not Modern Standard Arabic and not a
  word-for-word translation of the Hebrew. Natural phrasing first; the facts stay identical.
- The name is **ليف يام** (FACTS). The village is **جسر الزرقاء**.
- Arabic is drafted, then marked `[ar-draft]` until the owner signs it off; `ar_signed` on the
  post record is the sign-off.
- Never letter-spaced; RTL punctuation checked on a phone before it ships.

## Per channel

| Channel | Length | The action (CTA) | Hashtags | Emoji |
|---|---|---|---|---|
| Instagram | the first line is the hook (it is all that shows); 3–6 short lines | one, at the end: the theme's WhatsApp inquiry, or "link in bio" to a story | 3–5: the place + the audience (e.g. `#לבים` `#ימגיבוש` `#אירועפרטי` `#جسر_الزرقاء`); a Hebrew hashtag cannot hold an apostrophe, so the village goes in the text, never as a misspelt tag | at most 2, never in place of a word |
| Facebook | 2–4 short paragraphs; the link in the text with its UTM | one, at the end | 0–2 | at most 2 |
| Google Business Profile | ≤ 1500 chars, the first 100 carry the point | the button (Call / Learn more with UTM) — one | none | none |
| WhatsApp status | one line over the image | "שלחו הודעה" / "ابعتولنا رسالة" | none | at most 1 |
| Site (stories, יוזמות) | the page's own rules (ADR 0053) | the page's `data-cta` / the WhatsApp button | none | none |

- **One action per piece.** Two asks is none.
- **Every owned link carries UTM** (`content/README.md` — the post ID is `utm_campaign`).
- HE and AR are posted as **two separate pieces** on Instagram and Facebook (one language each,
  same media), not one bilingual caption — each reads natively and RTL never mixes.

## What the loop has learned

*Amendments land here, newest first, each with the post IDs that showed it and the date — the
monthly audit proposes them (the plan's "What makes it evolve" §1).*

- (none yet — the first pack is the baseline)
