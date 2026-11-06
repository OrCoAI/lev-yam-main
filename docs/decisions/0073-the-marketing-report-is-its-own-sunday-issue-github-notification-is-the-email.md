# 0073 — The marketing report is its own Sunday issue; GitHub's notification is the email; the engineering weekly hands over its marketing sections

- **Date:** 2026-11-04
- **Status:** accepted — amends mandate items 2 and 7 in [ROADMAP.md](../ROADMAP.md), the "Automations" and "Outcome check" rules in `CLAUDE.md`, and §3 of [0047](0047-analytics-wiring-ga4-and-gsc-only-public-numbers.md) for the one-day artifact and the publishing step of [0048](0048-report-agents-hold-no-write-and-actions-are-sha-pinned.md)
- **Decided by:** owner + Claude Code (kickoff of [plans/marketing-weekly-report.md](../plans/marketing-weekly-report.md))
- **Source:** the `feature-spec` alignment questions, 2026-11-04, in session

## Context

Mandate item 2 asked for a weekly issue **and** an email "with its own scoped send credential —
Tier A, security review". At kickoff most of the report already existed: traffic, clicks per page,
outcome checks and the content freshness numbers all sit inside the engineering weekly. And GitHub
already emails a notification when an issue opens, so the credential would buy a nicer email, not
the delivery itself. A send credential would be the first secret of its kind on a job that reads
public text (ADR 0048), and a send service needs a sender domain verified in DNS on `levyam.com`.

Separately, the report's real job is the posting cadence: no post record is marked posted and none
of them is a reel, while ADR 0072 asks for ten reels by 2026-11-30.

## Decision

1. **The email is GitHub's notification of the report issue.** No send credential, no send service,
   no DNS change. This drops the roadmap's "own scoped send credential"; a real send would be a new
   decision, made if the notification proves not to work for the owner.
2. **The report is its own issue,** `Marketing report YYYY-Www`, labelled `marketing-report`, published
   by the same worker and the same `publish` job as the other reports (ADR 0048, decision 12).
3. **The engineering weekly hands over its marketing sections.** Traffic, clicks per page, content
   freshness and the outcome checks due move to the marketing report; the weekly keeps a link. This
   goes one step past the roadmap line, which named only the Analytics headline: the outcome checks
   move too, so the owner reads them in one place. `CLAUDE.md`'s rule that the weekly lists due checks
   moves with them.
4. **It runs Sunday evening beside the engineering weekly.** The week it reports is the Monday-to-Sunday
   week ending that day, so the cadence line reads the marks from that Sunday's content session — but
   only once the session's PR is merged. An unmerged session understates the week.
5. **A reel is marked by a field.** A post record of a reel carries `reel: <slug>`, so "ten different
   reels" counts different slugs, and one reel posted on two channels counts once.
6. **AI citations print `n/a` with the reason** until a log exists; it belongs to mandate item 3.
7. **The report carries all the analysis the sources allow, in one PR.** The owner asked for *"all the
   analysis possible on what is going on with the website and all the marketing channels"* and chose
   this over shipping the native numbers as the next spec. So the read half of mandate item 7 joins item
   2, one initiative; item 7 keeps the owner-session connector and UTM on owned links.
8. **Native numbers are read directly from Meta and Google, not through Windsor.ai.** Windsor's docs list
   write actions on Instagram and Google Business, and draft-only is ADR 0068's rule. A fixed pre-agent
   step holds the credentials and writes a file of totals (the ADR 0047 pattern). This is not a connector:
   ADR 0068 §2 stands, no agent holds one, and every channel stays in `draft`.
9. **Native totals may appear in the public issue,** extending ADR 0047 §3: followers, reach, saves,
   calls and directions are not PII, prices or customer data. Comment text, review text, handles and
   audience lists are never fetched, and a Google Business keyword is kept only with an exact count: a
   row with just a threshold is a low-volume search, which at this venue's size can be a person's name.
10. **The snapshot credentials live in their own job, on a runner no agent uses.** The gate's security
    review found the first version's secrets in the publish step, after the agent, where git and Python
    read files the agent could have written. So the `snapshot` job names every snapshot credential,
    scans its files for them, and hands the files over as a public artifact kept one day. That amends
    ADR 0047 §3's "never archived": the artifact holds totals and scrubbed free text.
11. **The Google credential can write, so it belongs to a Manager account, never the owner.** The
    Business Profile APIs have one scope, `business.manage`, and it is the same capability that ruled
    out Windsor.ai under decision 8. Reading through it is enforced by the code, not by the token. A
    dedicated Manager account limits what a leak costs: it cannot add users or remove the profile.
12. **Publishing moved to its own job, for all four reports.** The gate's re-review broke the first fix:
    a clean git config kept in `$RUNNER_TEMP` is as writable as the original, and `jq` sources `~/.jq`,
    so a step after the agent on its runner could not be hardened into safety. `report` now hands
    `report.md` on as a base64 job output, the `video-guidelines-refresh.yml` hand-off, and `publish`
    vets it on a fresh runner. Not an artifact: the file is unvetted, and the run log masks secrets
    where an artifact does not. The agent's token drops to `issues: read`, and its job drops
    `id-token: write`, which could be exchanged for the Claude App's write token: at the pinned action,
    passing `github_token` means no OIDC call. So "it cannot publish" holds at the token layer too,
    provided the acceptance run proves the job runs without that grant.

## Consequences

- The report adds secrets to a workflow that reads public text, which item 2's roadmap line already
  expected. They never reach the agent's runner. `GOOGLE_SA_KEY` moves to the same job, for every report.
  No step of ours with a credential runs after the agent on its runner; the `checkout` and
  `claude-code-action` post steps still do, with the agent's own token. The email part still adds no secret.
- A withheld report stays in the public run log as base64, because a step's env is printed there. A
  literal secret is masked, or drops the output and turns the run red; an encoded one is not, and it
  could ride the issue anyway. The guard's refusal therefore means rotate, not contained.
- The agent can still send text out: an encoded value in the report or the step summary. `gh` reads
  reached any host until URLs and `-R` were denied, and that deny is a pattern. Giving these agents no
  `gh` at all is a follow-up; the design narrows the ways out and does not remove them.
- Google must approve API access first, for an unknown time. Google Business prints `n/a` until then.
- WhatsApp status views and Instagram story numbers stay out: the first has no official source, and the
  second lives for 24 hours, which a weekly run cannot read.
- The owner must watch the repo for the notification to arrive; the acceptance run proves it.
- `content-week`, `session-start`, `feedback-triage`, the quarterly evidence pack and the plan template
  point at the new home of what moved.
- A session whose PR merges late costs that week's cadence number. The owner chose this over a Monday
  report, which would have left a margin.
- Reels posted with no `reel:` field are not counted. That is a finding for the Sunday session, not a
  change to the rule.
