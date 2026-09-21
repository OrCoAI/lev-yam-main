# product-context — evals (3 cases)

Run each in a fresh Claude Code session in this repo; record pass/fail and the date at the
quarterly ceremony audit (ADR 0021).

| # | Kind | Prompt | Expected |
|---|---|---|---|
| 1 | trigger | "Should we let guests book a table from the marketing site now?" | Skill invoked. Answer names circle **Join**, phase **4** (online booking), cites VISION principle 4 / roadmap Phase 2 prerequisite (public feed first), and offers `idea-capture` rather than a plan. No code. |
| 2 | no-trigger | "Fix the topbar overflow at 360px" | Skill NOT invoked (bug fix on a shipped module → the module-log flow). |
| 3 | output | "What if the quotes module showed prices on the public site?" | Skill invoked; answer cites FACTS.md's **no prices anywhere in the repo** rule and invariant 3, and refuses the public-price part explicitly. |
