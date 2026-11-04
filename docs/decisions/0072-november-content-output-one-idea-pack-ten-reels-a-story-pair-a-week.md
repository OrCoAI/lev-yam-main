# 0072 — November's content output: one idea cut for four channels, a daily Instagram photo, ten reels, a story pair a week

- **Date:** 2026-11-04
- **Status:** accepted for November 2026 — sets the weekly output of [plans/content-media-foundation.md](../plans/content-media-foundation.md); overrides the roadmap's "a reel a week" (item 2) and sets the story pace [ADR 0052](0052-stories-four-pairs-a-week-for-the-first-month.md) left open after 2026-10-24 (item 4). The December review of these numbers is its own decision.
- **Decided by:** owner + Claude Code
- **Source:** the owner's answers in the session of 2026-11-04, after the status review of mandate item 1

## Context

No post record is marked posted yet. The owner posted none of the first pack (`content/VOICE.md`
holds why), and the second pack holds only Instagram and Facebook pieces. "The pack" had no fixed shape: the first held four different ideas, the second two.
The roadmap asks for a reel a week, six reels are built and none has been posted, and the story pace
after 2026-10-24 was never set.

## Decision

1. **The weekly pack is one idea, cut for four channels:** Instagram, Facebook, Google Business and
   WhatsApp status. The owner sees one finished piece, then the rest are made. The suggested days are
   Tue, Wed, Thu and Fri. ADR 0071's fresh look, VOICE.md's short captions and the three-caption rule
   all stand.
   **The Instagram piece is a carousel:** 5 slides at 1080×1350 (`ig-post`) — a cover, the moments,
   and the WhatsApp button on the last slide. Words on a slide come from the signed captions (ADR 0071 §4).
2. **Four packs follow the November sessions**, as proposed to the owner on 2026-11-04:

   | Session | Posts go out | Audience | Card |
   |---|---|---|---|
   | Nov 8 | Nov 10–13 | companies | `card-year-end-team-day` |
   | Nov 15 | Nov 17–20 | private | `card-sunset-celebration` |
   | Nov 22 | Nov 24–27 | companies | `card-work-day-by-the-sea` |
   | Nov 29 | Dec 1–4 | renters | `card-workshop-retreat-venue` |

   The weekend audience has no pack of its own in November; its share of ADR 0070 returns in December.
3. **A photo for every day, made on Sunday.** Each session delivers seven photos for the week ahead,
   starting Nov 9, labelled by day, each cut for a story (`story`) and a post (`ig-post`) so the owner
   chooses when posting. They carry that week's look (ADR 0071), the logo and brand icons, and no words,
   so they need no Arabic sign-off. Claude works only in an open session, so "every day" means a
   photo for each day, not a new one made that morning.
4. **Ten different reels, posted by 2026-11-30.** This overrides "a reel a week" for the month. Six are
   built, four are new through the `new-video` skill.
5. **One story pair a week**, four in November, picked from the backlog cards with `FACTS.md` already
   covering them, business first. The workshop-retreat pair lands before the Nov 29 pack links to it.
6. **This week stays Instagram and Facebook only** (owner: leave as is, keep the target). The target of
   3 of 4 weeks stands. W44 had no posts and W45 cannot be a full week, so the best possible primary
   number on 2026-11-26 is **2 of 4**.

## Consequences

- The plan's "about 45 minutes a week" no longer describes November. Each reel and pair adds
  review and Arabic sign-off on top of the Sunday session, and each new reel adds a `new-video` interview.
- The month needs about 52 photos (7 daily, 5 slides and the pack's photo each week). `Media/10 Picked`
  holds 33 cleared photos that fit both sizes, so the Sunday sort continues, and a photo is reused
  only where the pile runs short.
- A daily photo is presence, not an ask: it has no action, an exception to ADR 0070's one action per
  post, and its `theme` is the closest audience. The week's action stays on the pack.
- Each daily photo is an ordinary post record. A wordless one says `(no words)` under `## HE`, `## AR`
  and `## Mixed`, and `ar_signed` is the session date, because the check requires both before
  `posted`. It shows the owner saw the piece; it is not an Arabic review.
- The session rule stands: one spec per session. The pack, a story pair and a reel are separate
  sessions, so Sunday's session does not carry all three.
- Six built reels depend on the owner's answers before posting: `social` consent on the photos they
  show (done for `strategy-day-by-the-sea`, 2026-11-04), Arabic sign-offs, and for `moments-by-the-sea` the open §7 question in `video/GUIDELINES.md`.
- With the target unreachable, the Nov 26 verdict on the primary number is expected to be "did not".
  The check still runs: it says whether W46 and W47 went out full.
