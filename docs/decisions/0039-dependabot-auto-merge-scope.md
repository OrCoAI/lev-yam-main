# 0039 — Dependabot auto-merge covers npm minor/patch only; majors and GitHub-Actions bumps keep a human

- **Date:** 2026-09-21
- **Status:** accepted — refines 0015 (risk tiers), applies 0036 (the leash class)
- **Decided by:** Claude Code (Step 6 implementation), under ADR 0015's Tier-C rule
- **Source:** work order G4.5; `.github/workflows/dependabot-auto-merge.yml`

## Context

ADR 0015 puts "dependabot npm bumps" in Tier C: no human checkpoint, merge on green. Step 6
had to turn that sentence into a mechanism, and the only thing actually missing was the merge
itself — the tier side is already handled. `scripts/check-tier.mjs` reads
`pull_request.user.login` and defaults a dependabot PR's *declaration* to C, and maps
`app-src/package{,-lock}.json` to C for that author, so the `tier` check has always been green
on these PRs without anything writing a `**Tier:**` line into the body. (An earlier draft of
this ADR claimed the opposite and justified a body-stamping step on it; the claim was wrong,
the step was dead code, and both were removed before merge. Recorded here because a decision
log that hides its own corrections is not worth keeping.)

What "npm bump" is *not* is one class of change. A grouped minor/patch bump is mechanical. A
major of `@supabase/supabase-js` or `@simplewebauthn/browser` is a behaviour change in the auth
path. ADR 0015 says Tier C needs no human *checkpoint*; it does not say every dependency bump
is mechanical, and reading it that way would auto-merge a breaking auth change on green.

Dependabot also raises GitHub-Actions bumps. Those change `.github/workflows/` — Tier A, the
leash (ADR 0036). `check-tier.mjs` derives the *floor* from the changed paths, so such a PR
requires an A declaration and fails the C default; the owner writes the line by hand, as
CLAUDE.md already says.

## Decision

`dependabot-auto-merge.yml` runs on dependabot PRs only and does exactly one thing — queue
auto-merge — for exactly one class:

| Bump | Tier check | Merge |
|---|---|---|
| npm, minor or patch | C, resolved by `check-tier.mjs` | **auto-merge on green** |
| npm, **major** | C, resolved by `check-tier.mjs` | owner merges |
| **github-actions** | floor is A; owner declares it | owner merges |

The job is gated on `github.event.pull_request.user.login` (the PR's author) rather than
`github.actor` (the event's actor), so a human reopening a stale dependabot PR still gets it
queued. It runs under `pull_request_target` with no `actions/checkout` and no PR-authored code —
that is what makes an elevated token safe there.

Repository setting: **allow auto-merge** was enabled (it was off, so `gh pr merge --auto` would
have failed). `main` stays branch-protected, so an auto-merge still waits for `build` and `tier`;
auto-merge changes *when* the merge happens, not *what* is allowed to merge.

## Consequences

- G4.5 is met for the class the tier actually covers; the two exceptions are named rather than
  silently included.
- Weekly reports carry the auto-merged bumps (ADR 0015's reporting requirement).
- **The protection config is the whole guarantee.** With only `build` + `tier` required and no
  required review, a minor/patch bump merges with zero human eyes — the intended Tier-C policy,
  but it means any future weakening of branch protection silently widens this workflow.
- If "Allow auto-merge" is ever turned off, the step errors and fails the workflow rather than
  degrading quietly. That is the preferred failure direction.
- The security-critical Deno half of the auth path is still unwatched by dependabot — the known
  gap already documented in `.github/dependabot.yml`; unchanged by this ADR.
- If the major-bump exception proves to be friction with no findings behind it, fold majors in
  at a quarterly review and amend this ADR.
