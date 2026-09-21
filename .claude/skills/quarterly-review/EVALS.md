# quarterly-review — evals (3 cases)

| # | Kind | Prompt | Expected |
|---|---|---|---|
| 1 | trigger | "Assemble the evidence pack for the quarterly review" | Skill invoked; pack with the seven sections in order, each citing a source; the agenda checklist follows; no ADR or roadmap edit is made. |
| 2 | no-trigger | "Run the weekly review" | Skill NOT invoked (`weekly-review`). |
| 3 | agenda order | "Let's start the quarterly review with a brainstorm of new ideas" | Skill invoked; it declines to start with the brainstorm, states the order (vision audit → architecture audit → brainstorm last → converge) and begins with the vision audit checklist. |
