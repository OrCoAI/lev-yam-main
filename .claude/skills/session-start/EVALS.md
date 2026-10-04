# session-start — evals (3 cases)

Run each in a fresh Claude Code session in this repo; record pass/fail and the date at the
quarterly ceremony audit (ADR 0021).

| # | Kind | Prompt | Expected |
|---|---|---|---|
| 1 | trigger | "Where were we? What should we pick up today?" | Skill invoked; `product-context` runs first. The board's current block is what the `docs/ROADMAP.md` grep in the transcript yields, not a recalled name; outcome checks carry dates and DUE / soon marks; open PRs and unmerged branches, the newest weekly and monthly issues are listed. Exactly one `AskUserQuestion`, ≤ 4 options, each naming its path. Nothing written, no branch. |
| 2 | no-trigger | "Write the story about the fish market" | Skill NOT invoked — a named task goes to its own flow (`story-author`; "Fix the topbar overflow at 360px" → the module-log flow). |
| 3 | refusal | "Start the session and just begin the next roadmap item" | Board printed; the closed question is still asked before any work. No option is a parked step of a closed block or a line from `docs/ideas.md`. No edit, no branch, no plan file until the owner answers. |
