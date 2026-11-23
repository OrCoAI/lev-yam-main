# Marketing report YYYY-Www
<!-- The title line is matched EXACTLY against existing issues to decide comment-vs-create,
     so it carries the ISO week and nothing else. The window goes on the line below. -->

*Week ending YYYY-MM-DD. Each source's own window is named on its line.*

## At a glance
<!-- SKILL.md step 8, written last with step 7. Markers and arrows: SKILL.md "Graphs and markers". -->
| | This week | vs 4-week average |
|---|---|---|
| 🟢 `whatsapp_click` | n | ▲ +N (+P%) |
| 🔴 Sessions | n | ▼ −N (−P%) |
| ⚪ Search clicks | n | … |
| ⚪ Reels posted | `posted` of `reels` by `by` | — |
| ⚪ Cadence | `met` of `of` weeks, or `first week ends YYYY-MM-DD` | — |

**Next:** the one thing the owner should do this week.

## What the week means
<!-- SKILL.md step 7: 3–5 lines, written last, each naming a number below. The next step is on the **Next:** line above, never repeated here. -->

## Did it go out? — cadence
<!-- queries.md §3. One row per entry of `cadence.weeks`. When it is empty, no table, only:
     `The target's first week, YYYY-Www, ends YYYY-MM-DD — nothing to count yet.` (from `content/channels.json` `cadence.from`) -->
| Week | Pack on every channel | Different reels (target N) | Met |
|---|---|---|---|

Cadence: `met` of `of` weeks · reels `posted` of `reels` by `by` · drafted, never marked posted: N

<!-- Shape only: every label and number in this block comes from the files, never from this example. -->
```text
Reels  ▓▓░░░░░░░░  2 / 10 by YYYY-MM-DD
```

## What did it bring? — website
<!-- queries.md §1. One line per source; keep the `ga4.thresholded` / `ga4.page_attribution` note,
     when present, as the last bullet of this section. -->
- GA4 (YYYY-MM-DD → YYYY-MM-DD): sessions … (Δ …) · users … · engagement …% · `whatsapp_click` … (Δ …) — top pages: `…` n, `…` n, `…` n · top sources: `…` n, `…` n · channels: … / …
- Search Console (YYYY-MM-DD → YYYY-MM-DD): clicks … (Δ …) · impressions … (Δ …) · CTR …% · avg position … — top queries: `…` n, `…` n, `…` n · top pages: `…` n
- Devices: … · Countries: … · New vs returning: … · Arabic URLs: sessions … clicks … (the homepage's Arabic visits are not separable)

<!-- Shape only: every label and number in this block comes from the files, never from this example. -->
```text
This week against the 4-week average (each pair on its own scale)
Sessions       week ██████████████       59
               avg  ████████████████████ 85
WhatsApp       week ████████████████████ 17
               avg  ██████████████       12
Search clicks  week ████████████████████ 13
               avg  ████████████          8
```

<!-- Shape only: every label and number in this block comes from the files, never from this example. -->
```text
Sessions by landing page
/                   ████████████████████ 46
/happening/walking  ████                 10
```

<!-- Shape only: every label and number in this block comes from the files, never from this example. -->
```text
Sessions by device
mobile   ████████████████████ 52
desktop  ███                   7
```

| Landing page | Sessions | Engaged | `whatsapp_click` | Conversion |
|---|---|---|---|---|

Search opportunities (position 4–10): `…` position … · … impressions

## Who did it reach? — channels
<!-- queries.md §1 + §2 -->
| Channel | Window | Followers (Δ) | Reach (vs previous) | Interactions / saves | Visits from it | `whatsapp_click` from it |
|---|---|---|---|---|---|---|
| Instagram | | | | | | |
| Facebook | | | | | | |
| Google Business | | calls … · directions … · website clicks … · impressions … | | | | |
| WhatsApp | | n/a — no official source for status views | | | | |

<!-- Shape only: every label and number in this block comes from the files, never from this example. -->
```text
Reach, this week against the previous one (only channels with a number)
Instagram  week ████████████████████ 1,240
           prev ███████████████        930
```

| Post | Date | Reach so far | Saves / reactions | Shares |
|---|---|---|---|---|

Google Business search terms (YYYY-MM): `…` n

Not here by nature: Instagram stories (their numbers last 24 hours), the slides inside a carousel.

## Content freshness
<!-- queries.md §3 -->
- Outcome: `count` of `of` weeks with a pack posted on every channel in `outcome.channels` — each week ✓/✗
- Days since the last post: one `<channel> <days_since>/<pack_days>` per channel, `never` for a `null` — overdue: …
- Photos published YYYY-MM … (last month …) · backlog … cards, … stale · story pairs past re-check: …

## AI citations
n/a — no log yet (mandate item 3)

## Outcome checks due
<!-- queries.md §4 -->
| Plan | Metric | Check date | Overdue by |
|---|---|---|---|

*Sources: `.reports/analytics.json` (GA4 + Search Console), `.reports/social.json` (Meta + Google Business), `.reports/freshness.json` (content records), `docs/plans/`.*
