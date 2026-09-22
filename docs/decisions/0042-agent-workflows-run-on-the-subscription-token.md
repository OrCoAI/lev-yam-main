# 0042 — The agent workflows authenticate with the owner's Claude subscription token, not API credits

- **Date:** 2026-09-21
- **Status:** accepted — revisit at a quarterly review once `@claude` usage volume is known
- **Decided by:** owner (2026-09-21)
- **Source:** Step 6 acceptance runs; `anthropics/claude-code-action` inputs (`claude_code_oauth_token`)

## Context

Step 6's five workflows were wired to an `ANTHROPIC_API_KEY` repo secret. Every acceptance dispatch
failed identically after two real bugs had been fixed (PR #59, #61): `is_error: true` in ~200 ms, one
turn, $0, empty `modelUsage`, no error text. Nothing was billed, so the request was rejected before
it ran. The owner confirmed the cause: **the Anthropic API account behind the key has no prepaid
credits.** The API is billed separately from the Claude subscription the owner already pays for.

The action officially accepts a **Claude Code OAuth token** (`claude setup-token`, subscription
required) as an alternative to an API key.

## Decision

The workflows run on the owner's subscription token, stored as `CLAUDE_CODE_OAUTH_TOKEN`. No API
credits are purchased for now. Trade-offs accepted knowingly:

- Runs draw on the subscription's usage allowance. Three small read-only reports a month is
  negligible; `@claude` build tasks are heavier but only run when invoked.
- A run that lands inside a plan rate-limit window fails instead of costing money; at this volume a
  failed cron simply runs again next week.
- The token is tied to the owner's account and is long-lived but not permanent — regenerate at the
  2027-01-01 quarterly review (roadmap item). An expired token fails loudly; a missing one exits clean.
- "Cost per merged PR" in the weekly report stays unmeasured, since nothing is metered.

## Consequences

- `anthropic_api_key` → `claude_code_oauth_token` in all five workflows; the key guard checks the new
  secret. The unused `ANTHROPIC_API_KEY` secret can be deleted.
- Revisit API credits when a quarterly review has real numbers on `@claude` usage; switching back is
  the same one-line change in reverse.
