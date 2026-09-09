# 0022 — Agent permissions allowlist; settings file is Tier A forever

- **Date:** 2026-08-13
- **Status:** accepted — amended by ADR 0036 (leash = class). Scope note (Step 2 gate, 2026-09-09): `ask`/`deny` catch direct invocations only; allowed interpreters (`node`, `npx`, `python3`) and `find -delete` can route around them, and the Read deny gates the Read tool, not shell reads — owner-accepted trade-off ("gating interpreters separately is theater"); the committed file is authoritative over the command list below
- **Decided by:** owner (strategy session with Claude Code)
- **Source:** `docs/plans/master-execution-plan.md` Part 1 #8; `docs/plans/lev-yam-gap-analysis-work-order.md` G8

## Context

From the work order: "Interactive Claude Code sessions stop for approval on every routine
command; keystroke friction is the other half of the bottleneck (G1 removes process friction,
this removes prompt friction)."

## Decision

A committed `.claude/settings.json` with `"defaultMode": "acceptEdits"` and a ~45-rule
permissions block, precedence deny → ask → allow:

- **Allow:** file/shell basics; `node`, `npx`, `python3`, `npm run/test`, `deno check`; local
  `supabase start/stop/status/db reset/db diff/functions serve`; read-side git plus `add`,
  `commit`, `checkout`, `stash`, `fetch`, `pull`; **`git push origin staging`**; `gh pr
  create/view/list`, `gh run/issue/workflow`; **`dtctl get/describe/query/version`**; **`bluebox
  ask`**; `curl` scoped to localhost.
- **Ask:** any other `git push`, `git merge`, `gh pr merge`, `supabase db push / functions
  deploy / secrets`, `dtctl apply/edit/delete`, `gh api`, `rm`.
- **Deny:** reading any `.env*` at any depth, `rm -rf`, `git push --force/-f`, `dtctl auth`.

Rationale kept from the source: interpreters are the same trust class as `npm run`, so gating
them separately "is theater"; `git push origin staging` encodes the existing pre-authorized
staging rule; dtctl reads allowed / writes ask mirrors the readonly/write context split (ADR
0027); `dtctl auth` is owner-interactive, never agent-driven; `bluebox ask` is read-only and
the production-context step depends on it being frictionless.

**Standing rule:** `.claude/settings.json` is itself **Tier A forever** — an agent editing its
own permissions is the one diff that always gets the owner's eyes.

## Consequences

- Tune organically for one week ("always allow" on remaining routine prompts), then review with
  `/permissions` and commit.
- Acceptance: a routine bug-fix session completes with zero permission prompts; pushing or
  merging still asks; reading any `.env` is blocked.
- Deferred, strategy notes only: OS sandbox (`/sandbox`) to broaden the Bash allowlist further;
  `bypassPermissions` exclusively inside ephemeral CI runners (ADR 0018), never on the laptop.
