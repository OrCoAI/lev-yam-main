# Marketing — Weekly report

*Kickoff 2026-11-04 · branch `marketing-weekly-report` · roadmap block: Phase 2 — 2026-Q4 mandate, item 2 · tier: A (ADR 0015)*

## Why
Six reels are built and no post record is marked posted, while
[ADR 0072](../decisions/0072-november-content-output-one-idea-pack-ten-reels-a-story-pair-a-week.md)
asks for ten reels by 2026-11-30. The marketing numbers exist, but they sit inside the engineering
weekly, between PR tables and harness health, and nothing compares the week's posting with the
target. Inside the platforms it is worse: reach, saves, followers, calls and direction requests reach
nothing in the repo. The owner asked for "all the analysis possible" on the website and every channel,
in one PR, so the report gives one page a week on whether the marketing is going out, who it reached
and what it brought. This takes the read half of mandate item 7 into item 2.

## Outcome metric
| | |
|---|---|
| Metric | **Primary:** weeks with the cadence met, of W46, W47 and W48. A week is met when that week's pack is marked posted on all four channels (`ig`, `fb`, `gbp`, `wa`) **and** at least 3 different reels are marked posted. **Secondary:** reports delivered on their Sunday with real GA4 + Search Console numbers; Meta numbers real from the first report; Google Business numbers real by the check date |
| Source | The report's cadence line, from `.reports/freshness.json`, itself read from `content/posts/`. The `Marketing report` issues for the secondary |
| Baseline (today) | 0 weeks met · 0 of 7 post records marked posted · 0 reels recorded · 0 reports (2026-11-04) |
| Target | **2 of 3 weeks** · **3 of 3 reports** · Meta 3 of 3 · Google Business in the W48 report |
| Check date | **2026-11-30** — the Monday after the W48 report, and ADR 0072's reel deadline; the marketing report lists it when due |
| Verdict owner | owner |

Three reels a week is the pace for ten by 2026-11-30. "Cannot tell" means the session marks were
not merged before the Sunday run, or a reel record lacks `reel:` — a finding about the marking step,
not a pass. A "did not" names its cause: six reels wait on consent, Arabic sign-offs, renders and
the `video/GUIDELINES.md` §7 question, so the verdict separates "the report did not move the
posting" from "the reels could not be posted".

## Scope
- **`marketing-report` skill** (`SKILL.md`, `queries.md`, `report-template.md`, `EVALS.md`) in the
  report order: what the week means (3–5 lines, every number sourced), cadence, website, each
  channel, content freshness, AI citations (`n/a`), outcome checks due. `queries.md` §5, §7 and §8 of
  `weekly-review` move here.
- **A deeper website read** in `scripts/analytics-snapshot.mjs`, on the existing Google key: landing
  pages, devices, countries, Hebrew vs Arabic pages, new vs returning, engagement rate, conversion per
  page (`whatsapp_click` ÷ sessions), and Search Console queries at position 4–10 as opportunities.
- **Each channel from the site's side:** visits and `whatsapp_click` per channel, from the `utm_source` and
  `referrers` in `content/channels.json`, and per post from the existing `post-days` numbers.
- **`scripts/social-snapshot.mjs`, a fixed pre-agent step** (the ADR 0047 pattern, the only step naming
  these secrets) writing `.reports/social.json`, totals only:
  - **Instagram:** followers, account reach, per-post reach and saves, taps on profile links.
  - **Facebook:** followers, Page reach, per-post reach and engagement counts.
  - **Google Business:** calls, direction requests, website clicks, impressions.
  - A source with no secret, or one that fails, writes `n/a` and the reason; the report still goes out.
- **`agent-report.yml`** gains `analytics` and `marketing_numbers` inputs and the optional secrets
  `META_ACCESS_TOKEN` and `GBP_REFRESH_TOKEN` + `GBP_CLIENT_ID` + `GBP_CLIENT_SECRET`, passed by the
  marketing caller only. The weekly turns `analytics` off and drops `GOOGLE_SA_KEY`. `report-guard.py`
  watches every `SCAN_*` a job passes. Publishing moves to its own job, for all four reports (ADR 0073 §12).
- **`.github/workflows/marketing-report.yml`** — Sunday 17:30 UTC, `workflow_dispatch`, calling the
  existing `agent-report.yml`, label `marketing-report`, title `Marketing report <ISO year>-W<week>`,
  `marketing_numbers: true`; every report's snapshots move to a new `snapshot` job on its own runner.
- **The `marketing-report` label**, created before the first run: the worker cannot create labels.
- **`reel:` in the post record** — an optional `reel: <slug>` front-matter field, checked for slug
  shape by `check-content.mjs`, documented in `content/README.md` and `video/GUIDELINES.md`.
- **`scripts/content-freshness.mjs` gains a `cadence` block** — the Monday-to-Sunday weeks of the dated
  target in `content/channels.json` `cadence` (W46–W48), each with its pack result, distinct reels and
  `met`. A week counts from the day it ends, so a Sunday run includes it. December's target is a change
  to that block. The existing `outcome` block keeps excluding the running week: the content plan's
  check reads it.
- **The engineering weekly hands over:** its Analytics headline, Content freshness and Outcome checks
  sections become one link to the `marketing-report` label, and it stops pulling analytics at all.
- **Pointers follow the move:** `content-week` step 0 (`--workflow marketing-report.yml`), `session-start`
  step 2d, `feedback-triage` line 37, the quarterly `evidence-pack.md`, `plan-template.md`, and
  `CLAUDE.md`'s Outcome check, Operating cadence, Automations and skills lines.

## Explicitly out of scope
- **A real email** — GitHub's notification carries it ([ADR 0073](../decisions/0073-the-marketing-report-is-its-own-sunday-issue-github-notification-is-the-email.md)).
- **WhatsApp status views** — no official source found. The unofficial gateway is refused: it returns
  who viewed, which is personal data. The WhatsApp line shows the site-side numbers only.
- **Instagram story numbers** — they exist for 24 hours, so a weekly run cannot read them; a daily job
  is a separate decision.
- **Per-slide carousel numbers** — not available inside an album; the carousel reports as one post.
- **Comment text, review text, handles, audience lists** — never fetched (ADR 0069 §3, invariant 3).
- **Ad numbers** — mandate item 8.
- **The owner-session connector and UTM on owned links** — they stay in mandate item 7.
- **An AI-citation log** — mandate item 3; it would add a weekly owner task.
- **Writing the missing reel post records** — made by the Sunday session as reels go out, never
  backfilled for a reel that did not go out.
- **Fixing what blocks the reels** — consent, sign-offs, renders and §7 stay with item 1.
- **Hebrew or Arabic report text** — it is an internal document like the other reports, in English.
- **December's cadence** — ADR 0072 sets November only; the December monthly review sets the next
  target, as a change to the `cadence` block in `content/channels.json`.

## Schema, RLS, permissions
None. No table, no permission, no spine, no Edge Function.

## UI surface
No app or public page. The surface is a public GitHub issue and its notification email. ADR 0073
extends ADR 0047 §3 to native totals: public, and never a price, name or customer detail. With no UI
diff, gate step zero is skipped.

## Rollback
Revoke the Meta token, remove the Manager account from the profile, delete the four secrets, then revert the PR: the weekly gets its sections back and `content-week` reads the old workflow. The label
and past issues stay. `reel:` is additive: records carrying it stay valid after a revert, since the
check does not refuse fields it doesn't know.

## Checks
- **Roadmap:** current block, item 2. The roadmap line is amended by ADR 0073 and links this plan.
- **Architecture:** invariants 1, 4, 6 no surface. 2 + 3: no new browser key, no PII; the report's
  inputs are totals, and publishing stays a fixed step, now in its own job. 5: internal, English, like every report. 7: the weekly keeps
  running; only sections move. 8: the roadmap stays the tracker. §6's "side systems are additive":
  `reel:` and `cadence` are read by the report only, never by a page or a build. **Verdict: aligned.**
- **Vision:** serves the **Join** circle through the Q4 marketing mandate; principle 4 (public by
  default) holds, the numbers stay public. **Verdict: aligned.**
- **Security:** this adds new secrets to a workflow that reads public text, so the gate's security
  review is the point of the PR. They live in the `snapshot` job, on a runner no agent uses, and the
  agent reads files (ADR 0047, ADR 0073 §10). Meta's token carries read-only insights permissions. The
  Google token can write, because `business.manage` is the only scope: the code only reads, and the
  token belongs to a Manager account, never the owner (ADR 0073 §11). Text from the platforms is
  scrubbed in the script before any report (ADR 0047 §3).
  `allowed_tools` and `queries.md` are checked as one unit. **No connector runs here:** ADR 0068 §2
  still holds, every channel stays in `draft`, and a fixed step holds a read credential.

## Delivery
One Tier-A PR through the full gate: `.github/workflows/` and `scripts/` make it a runtime diff, and
`.claude/` and `CLAUDE.md` make it a leash change. Merged **before Sunday 2026-11-15 17:00 UTC**, or
W46 is lost and the target becomes 2 of 2. The site does not change, so staging proves only that the
deploy is unaffected. Google's approval has no known duration: if it is not in by the merge, the PR
merges with Google Business printing `n/a` and that fetcher untested, said plainly in the PR, and it is
tested the day the secrets exist. No part of the merge waits on it.

**The owner's setup, before the first live run** (exact click paths go in the PR):
1. **The label:** `marketing-report` created in the repo, or the first report cannot publish.
2. **Meta:** the Instagram is a professional account linked to the Page; one Meta app; one long-lived
   **Page** token, from a Business Manager system user where possible, with `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`, `read_insights`
   (the last one to confirm at setup); the secret `META_ACCESS_TOKEN`.
3. **Google:** a dedicated Google account added to the profile as a **Manager**, never the owner's login;
   a Cloud project; the Business Profile API access request, from that account; the OAuth client; the
   three `GBP_*` secrets, from that account. The OAuth app must not stay in "testing", or the refresh
   token may expire (to confirm at setup). Confirm Manager reaches every metric.
4. **Secrets go one at a time**, and both join the `GOOGLE_SA_KEY` rotation at the 2027-01-01 review.

The acceptance test is `workflow_dispatch` on `main` after the merge: one `Marketing report` issue
appears and the owner confirms the email reached them. It takes the week of the most recent Sunday, so a
Sunday run with the same title comments on it instead of opening a new one.

## Open questions
**Blocking:** none.

**Non-blocking:**
1. Is the owner watching the repo, so the notification is sent? Answered by the acceptance run.
2. Whether the Instagram account is professional and linked to the Facebook Page. Answered at setup;
   if not, the owner links it before the first live run.
3. Whether the deep read fits the agent's turn budget. Measured on the acceptance run; `max_turns` is
   a runaway guard, so it stays well above the real count.
4. The Sunday session's usual hour. The weekly is scheduled for 17:00 UTC, but its last five issues
   opened between about 21:30 and 23:50 Israel time, which leaves margin for merging the session's PR
   that evening. Nothing guarantees that delay, so the plan counts on a merge by 19:00 Israel time.

## Decisions made on the way
2026-11-04 · The email is GitHub's notification; marketing sections and outcome checks move out of
the weekly; Sunday evening; a reel is marked by `reel:`; citations print `n/a` · ADR 0073.
2026-11-04 · All the analysis in one PR: the read half of item 7 joins item 2, read directly from Meta
and Google, not through Windsor.ai · ADR 0073.

## Follow-ups found by the gate
- **Confirm the `post-days` artifact on the first real run** — none has ever been produced.
- **Take `gh` away from the report agents** — a fixed step dumps the issues and PRs they read into
  `.reports/`. The deny on URLs and `-R` is a pattern, and every report job has this exposure today.
- **`video-guidelines-refresh.yml`** still sets `GITHUB_*: /dev/null`, which does nothing, and
  `id-token: write`. Its agent has no shell, so neither is urgent; the claim in its header is wrong.
- **`git log -p` runs `textconv`** if the agent reaches `.git/config` by a redirect (weekly, monthly,
  quarterly; the marketing agent has no `git`).

## Gate waivers
Accepted by the owner on 2026-11-06, for this PR. Each stays open; none is made worse by it.
- **A run on a non-main branch receives the secrets.** Starting one needs write access to the repo.
- **Forged Google Analytics hits can move the numbers.** Accuracy only; nothing is exposed.
- **`git log -p` may run `textconv` for the weekly, monthly and quarterly agents.** On main already, and
  listed in the follow-ups above; the marketing agent has no `git`.

## Close-out

*2026-11-08 — shipped in [PR #173](https://github.com/OrCoAI/lev-yam-main/pull/173), merged 2026-11-06.*

**What shipped.** `marketing-report.yml` opens `Marketing report YYYY-Www` every Sunday at 17:30 UTC, labelled
`marketing-report`, from the new `marketing-report` skill. `scripts/social-snapshot.mjs` reads Instagram, Facebook
and Google Business; `analytics-snapshot.mjs` gained the deep website read; `content-freshness.mjs` gained the
`cadence` block, read from `content/channels.json`; post records gained `reel:`. The engineering weekly
links to the new issue instead of carrying those sections. `agent-report.yml` became three jobs for all four
reports: `snapshot` holds the credentials, `report` runs the agent on a read-only token with no
`id-token: write`, and `publish` vets and publishes on a fresh runner (ADR 0073 §10, §12).

**Proven live.** A weekly run from the branch proved `report` and `publish` without `id-token`, and
commented on #163. After the merge, the acceptance run opened [#174](https://github.com/OrCoAI/lev-yam-main/issues/174)
with all three jobs green: real GA4 and Search Console numbers, `n/a` with its reason for every channel
with no secret, and a `post-days` artifact, the first ever produced. Staging deployed clean after the idle
staging project was restored; production deployed on a re-run after a GitHub Pages sync timeout.

**Not proven yet.**
- **The email.** None arrived for #174: the owner's account was not watching the repo, so GitHub created
  no notification. The owner chose to watch it for issues (2026-11-08); the next report proves it.
- **Meta and Google Business.** None of the four secrets exist, so every metric name is unproven; the
  Delivery section's setup is the owner's.
- **The cadence lines.** #174 ran before the target's first week, so the agent filled the table from
  another count and printed `null`; the skill now says what to print, from its 0.1.1.

**Schema / permissions:** none in the database. In GitHub: the `marketing-report` label; the report jobs
drop `id-token: write` and their agent's token drops to `issues: read`.

**Decided on the way:** all in [ADR 0073](../decisions/0073-the-marketing-report-is-its-own-sunday-issue-github-notification-is-the-email.md)
§1–§12, amending ADR 0047 and 0048. The waivers above are the owner's, 2026-11-06.

**Left out, deliberately:** a real send credential, Instagram story numbers, WhatsApp status views,
per-slide carousel numbers, ad numbers, the AI-citation log, December's cadence (*Explicitly out of scope*).

**Alignment.** *VISION:* serves the **Join** circle through the marketing quarter; principle 4 holds, the
numbers stay in a public issue. *ARCHITECTURE:* no database, permission or browser-key surface; invariant 3
holds, the issue carries totals and scrubbed text, never PII or prices; the report jobs' threat model is
narrower than before and says plainly what it does not close. **No drift.**

## Outcome check
*(appended on the check date: metric value vs target, verdict, what it changes)*
