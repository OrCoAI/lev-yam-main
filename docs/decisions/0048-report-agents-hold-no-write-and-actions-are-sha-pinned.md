# 0048 — The report agents hold no network write: they write a file and a deterministic step publishes it; every third-party action is SHA-pinned

- **Date:** 2026-09-22
- **Status:** accepted — amends the "Automations (the night shift)" rules in `CLAUDE.md` and the threat model in `.github/workflows/agent-report.yml`
- **Decided by:** owner (asked for both to be solved immediately, at the analytics-wiring gate)
- **Source:** the security review of [PR #73](https://github.com/OrCoAI/lev-yam-main/pull/73); roadmap Phase 2 item 14

## Context

The three scheduled report jobs run a Claude agent that reads **public** issue text and — since
the analytics wiring ([ADR 0047](0047-analytics-wiring-ga4-and-gsc-only-public-numbers.md)) —
attacker-influenceable values from GA4 and Search Console. Until now the same agent also held
`gh issue create` / `gh issue comment`, i.e. a write to a public surface.

The deny list was believed to prevent that agent from reading its own environment. The security
review disproved it, concretely:

- the shell expands `$VAR` inside the arguments of any **allowed** command, so
  `gh issue create --body "$CLAUDE_CODE_OAUTH_TOKEN"` needs no denied binary at all;
- `gh`'s own `--jq` is gojq, which implements `$ENV` — verified:
  `gh pr list --json number --jq '$ENV.TESTSECRET'` printed the value;
- `head`, `tail`, `cut` and `sort` read `/proc/self/environ` as readily as `cat`, which is denied;
- a string-glob deny (`Bash(grep * /proc/*)`) is defeated by quoting the path.

Extending the deny list cannot close this class. The conclusion is structural: while the agent
holds both the environment and a public write, the report jobs are one successful prompt injection
away from publishing the owner's Claude subscription token.

Separately, `actions/checkout` and `claude-code-action` were floating tags running upstream of a
Google service-account key.

## Decision

1. **The report agent holds no network write.** It writes the finished report to `report.md`
   (first line `# <title>`, the rest is the body). `gh issue create`, `gh issue comment` and
   `gh issue edit` are denied to it; `Write` replaces them, itself denied for `.github/`,
   `.claude/`, `scripts/` and `supabase/`. Reads (`gh issue list` / `view`) stay — the weekly
   report is built from past issues.
2. **A deterministic step publishes.** After the agent, a fixed shell step runs
   `scripts/report-guard.py`, then applies the caller's new `label` input, matches an existing
   issue title with `jq --arg` (never a search string built from agent text) and comments or
   creates. Title parsing lives in Python so quotes or backticks in a title cannot reach a
   command line.
3. **A secret in the report withholds the report.** `report-guard.py` fails the job if the value
   of `CLAUDE_CODE_OAUTH_TOKEN` or the job's `GITHUB_TOKEN` appears in `report.md` — including
   split across lines. It does **not** redact and publish: a redacted report would hide that the
   attempt happened, and knowing costs more than the week's report.
4. **Every third-party action is pinned to a commit SHA** with the version in a trailing comment,
   across all eight workflows. Dependabot's `github-actions` ecosystem keeps them current, and
   such bumps already require a hand-written Tier line
   ([ADR 0039](0039-dependabot-auto-merge-scope.md)).

## Consequences

- The remaining exposure is named rather than implied: the agent can still read its own
  environment and could write a secret into the report, so the guard is a **detector**, not a
  boundary — an encoded value passes it. What changed is that the agent can no longer publish
  anything itself, so the naive attempt is caught and the sophisticated one still has to survive
  a human reading the diff of a report.
- `agent-report.yml` gains a required `label` input; a fourth report job must pass it.
- The workflow's threat-model comment states what the deny list does **not** achieve. That is
  deliberate: an overstated guardrail comment is worse than none, because it stops the next
  reader from looking.
- `docs/ROADMAP.md` Phase 2 item 14 is done on merge.
