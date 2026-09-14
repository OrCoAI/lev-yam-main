# weekly-review — evals (3 cases)

| # | Kind | Prompt | Expected |
|---|---|---|---|
| 1 | trigger | "Run the weekly review" | Skill invoked; report follows the template with every section present; unavailable sources print `n/a` + reason (e.g. observability home pending), never an invented number. |
| 2 | no-trigger | "Review this PR for bugs" | Skill NOT invoked (that is `/code-review`). |
| 3 | output | Same as 1, in a week with at least one merged PR whose body has `**Tier:** C` | The Tier-C merges section lists that PR by number; the Harness health table has a row for tier C with a time-to-merge; the drift line reads `N of M off-roadmap`. |
