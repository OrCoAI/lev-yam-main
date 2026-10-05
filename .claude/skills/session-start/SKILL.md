---
name: session-start
description: >
  Open a work session: load the brain (product-context), build a read-only board of what is
  open — the current roadmap block derived from docs/ROADMAP.md, outcome checks due, module
  bugs and ideas, open PRs and branches, the newest night-shift issues — and end in ONE closed
  question: which single item is this session. Writes nothing. Triggers: "start the session",
  "session start", "where were we", "what's next", "what's open", "what should we work on",
  "pick up where we left off", "good morning". Not for a named task ("fix X", "write the story
  about Y") — those go straight to their own flow.
metadata:
  version: '0.1.0'
---

# Session start

The start half of `docs/ROADMAP.md`'s "each work session should start by reading this file and
end by updating it", made executable — why: [ADR 0062](../../../docs/decisions/0062-instruction-files-state-rules-never-state-sessions-open-with-session-start.md).
Everything on the board comes from a command run now; the session is the one item the closing
question picks (CLAUDE.md "Session hygiene").

## 1. Load the brain

Run `product-context` steps 1, 2, 4 and the five-newest-ADRs half of 5. Its step 3 (the roadmap)
is step 2c below, which reads only the current block and the lane; the topic half of 5 and step 6
(a module log in full) wait until an item is chosen.

## 2. Build the board — read-only

Every command below matches the committed allowlist as written (`git status` without flags,
`date -u +%F` never as an assignment), so the morning opens without a prompt; a query that needs
another command changes `.claude/settings.json` in the same PR (ADR 0022). The six blocks are
independent — run them in one turn; inside a block join with `;`, never `&&`, so a failing
source prints `n/a — <reason>` and the rest still prints. Every board line names its source.

**a. Repo state** — unfinished work this session must not collide with.
```
git fetch --quiet --prune origin; git status; git stash list
git branch -a --no-merged origin/main                        # anything but staging = unfinished work
git log --oneline --no-merges --cherry-pick --right-only origin/main...origin/staging   # content on staging that main lacks
gh pr list --state open --json number,title,headRefName,isDraft,createdAt
```
The `git log` form drops merge commits (staging accumulates them and is never reset) and any
patch main carries under another hash. What remains is awaiting sign-off unless `git show
--stat <hash>` names files whose change main already has in another form — a by-hand hotfix
main later received differently is a ghost, not work; say which it is.

**b. The night shift** — the newest weekly and monthly issues, by the publisher's label (a
`--search` is ranked by match, not date). A rerun with the same title lands as a comment on the
existing issue (CLAUDE.md "Automations"), so `updatedAt` is the last activity, not `createdAt`.
```
gh issue list --state all --label weekly-review  --limit 1 --json number,title,createdAt,updatedAt,url
gh issue list --state all --label monthly-review --limit 1 --json number,title,createdAt,updatedAt,url
```

**c. The current block** — by `docs/ROADMAP.md`'s own **Blocks** rule (in its "How we work"
paragraph): apply it, don't restate it. The grep shows the headings and every unticked line,
indented ones included so a lane and a labelled follow-up list are seen; then read the block —
and the lane — in full; nothing else in the file is needed.
```
date -u +%F; grep -n "^## \|^ *- \[ \]\|ordinary items" docs/ROADMAP.md
sed -n '<block start>,<next ## minus 1>p' docs/ROADMAP.md
```
Per unticked item: **not started** (no `plans/…md` link) or **in progress** (the line's own last
bold state says where it stands), plus any date on it within 14 days of today, either side.

**d. Outcome checks** — the shipped-but-unvalidated list. Rule and the `*(appended on …)*`
placeholder trap: `weekly-review` step 5 / queries §5; its loop is not on the allowlist, so the
raw grep runs here, with two deltas: a **soon** window — **DUE** ≤ today, **soon** ≤ today +
14 days, else later — and the scoping §5 gets from `## Outcome metric`: a `## Outcome check`
heading with no `Check date` row is a pre-ADR-0019 plan, skipped, not retrofitted (CLAUDE.md
"Outcome check").
```
grep -n -A5 -E "^\| Check date|^## Outcome check" docs/plans/*.md
```

**e. Module logs** — every section but `## Done` (open bugs, open ideas, an in-progress batch):
the heading and the first line of each bullet that is neither struck through nor a `(none …)`
placeholder, counted per section; `###` is reserved for status sub-lists, which are skipped
(module logs keep open items at the top level); a bullet in an *in progress* section is a status
line — read it before calling it open; the full text waits for the chosen item.
```
awk '/^### /{p=0; next} /^## /{p=($0 !~ /^## Done/); if (p) print FILENAME":"FNR": "$0; next} p && /^- / && !/^- ~~/ && !/^- \(none/{print FILENAME":"FNR": "$0}' docs/modules/*.md
```

**f. Off the board by design:** `docs/ideas.md` (the monthly review empties it — the
queue-jumper rule, CLAUDE.md "Operating cadence") and a closed block's parked steps. The
Parked line says so, so absence is not read as emptiness.

## 3. Print the board

Compact — about 30 lines, read on a phone:
```
## Session start — YYYY-MM-DD
**Repo:** <branch>, <clean | N changed>; open PRs: <n> (<#, title, age> …); unmerged branches:
<list | none>; on staging, not in main: <n commits | none>; stashes: <n>.
**Night shift:** Weekly review <id> (#n, last activity <date>) · Monthly review <id> (#n, <date>).
**Current block:** <heading> (<open>/<total> open) — mandate: <the ADR the Blocks rule points to | n/a — none linked>
  - <n>. <item> — in progress: <plan>, <state>; <date within 14 days, if any>
  - <n>. <item> — not started
**Lane:** <parallel track> — <its unfolded, undeferred items>            (omit when empty)
**Follow-ups (ordinary, no block):** <items a closed block labels so>     (omit when empty)
**Outcome checks:** DUE <plan> (<date>) · soon <plan> (<date>) · later: <n>
**Module logs:** <module> <n bugs / n ideas / n in progress> · <module> … (one entry per log)
  - <module>: <first line of each bullet>
**Parked, not offered:** <n> steps in <closed block>; docs/ideas.md (monthly)
```
A source that fails prints `n/a — <reason>` on its line; the board still prints.

## 4. Propose, then ask — one closed question

Rank, then `AskUserQuestion`: one question, at most four options, the recommended one first and
marked, each option naming its path. The order is the operating cadence's, not the agent's taste:

1. **Evidence that a current bet is wrong** — the only interrupt (CLAUDE.md "Operating cadence").
   It comes from the board — a DUE check plainly failing, a weekly issue flagging drift — never
   from an idea.
2. **An outcome check that is DUE** (CLAUDE.md "Roadmap item close-out"). Path: the verdict into
   the plan's `## Outcome check`, numbers from the plan's own `Source` row.
3. **The block's in-progress item** — finish before starting (CLAUDE.md "Session hygiene").
4. **The next unstarted item in the block's own order** — or the lane's, once the block has none
   left; the owner reorders by editing the list, the skill never does. Path: `feature-spec`
   (`product-context` steps 1, 2, 4 and the five newest ADRs are done — say so; the rest runs
   there).

A module bug or idea is offered only when it blocks one of these or the owner asks for a light
session; path: CLAUDE.md "Ongoing module work". An item off the board is the owner's call and
goes through `product-context`'s answer section (CLAUDE.md's conflict rule; a later phase →
`idea-capture`). Name the pick and its path, then stop — the branch, the plan file and the first
edit belong to that flow.

## Never

- Never write anything, start the item, or offer a second one — even when asked to "just begin".
- Never name the block except through step 2c; never offer what step 2f excludes.
