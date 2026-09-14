# weekly-review — data queries

All read-only. `SINCE=$(date -u -v-7d +%F 2>/dev/null || date -u -d '7 days ago' +%F)`.

## 1. PRs merged in the window, with tier and timings
```
gh pr list --state merged --search "merged:>=$SINCE" --limit 50 \
  --json number,title,body,createdAt,mergedAt,author,url \
  --jq '.[] | {number, title, tier: (.body | capture("(?m)^\\s*\\*\\*Tier:?\\*\\*:?\\s*(?<t>[ABC])") .t // "?"), createdAt, mergedAt, author: .author.login, url}'
```
Time-to-merge = `mergedAt - createdAt`; median per tier.

## 2. Drift + rework
```
# off-roadmap: PR body/title mentions none of: "Step ", "Phase ", "docs/plans/", "docs/modules/", "ADR"
gh pr list --state merged --search "merged:>=$SINCE" --json number,title,body \
  --jq '.[] | select((.title + .body) | test("Step [0-9]|Phase [0-9]|docs/plans/|docs/modules/|ADR ") | not) | .number'
# rework: a second push after opening, or a changes_requested review
gh pr view <n> --json commits,reviews --jq '{pushes: (.commits | length), changes_requested: ([.reviews[] | select(.state=="CHANGES_REQUESTED")] | length)}'
# Gate-2 queue
gh pr list --state open --json number,title,createdAt,isDraft --jq '.[] | select(.isDraft|not)'
```

## 3. Davis problems (observability home — context name per ADR 0038 once it exists)
```
dtctl query 'fetch events, from:now()-7d | filter event.kind == "DAVIS_PROBLEM" | summarize count(), by:{event.status, event.name}' --context <home> --plain -o json
```
Until the home exists: print `n/a — observability home pending (ADR 0038)`.

## 4. Bluebox Routine findings
```
bluebox ask "Summarize the weekly health-check Routine findings for the last 7 days: failed requests per service, services with zero traffic, anything new."
```

## 5. Outcome checks due (plan files)
```
grep -l "## Outcome metric" docs/plans/*.md | while read f; do
  d=$(grep -m1 -E "^\| Check date" "$f" | grep -oE "[0-9]{4}-[0-9]{2}-[0-9]{2}" | head -1)
  filled=$(awk '/^## Outcome check/{f=1;next} f&&NF{print;exit}' "$f")
  [ -n "$d" ] && [ "$d" \< "$(date -u +%F)" ] && [ -z "$filled" ] && echo "$f due $d"
done
```

## 6. Roadmap ticks this week
```
git log --since="$SINCE" -p -- docs/ROADMAP.md | grep -E "^\+- \[x\]" | head -20
```
