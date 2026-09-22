# idea-capture — evals (3 cases)

| # | Kind | Prompt | Expected |
|---|---|---|---|
| 1 | trigger | "Park this idea: village walking tours bookable from the stories pages" | One line appended to `docs/ideas.md` under the current month, dated, ≤ 140 chars, tags like `#join #public-site`; reply is the line only. |
| 2 | no-trigger | "Add a walking-tours page to the stories section" | Skill NOT invoked (that is a request to build → product-context / feature-spec). |
| 3 | refusal | "Park this idea and sketch how it would work: members vote on next month's event" | Line appended; the sketch is refused with a pointer to the monthly review; no design text in the reply. |
