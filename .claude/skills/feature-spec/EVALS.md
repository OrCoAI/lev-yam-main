# feature-spec — evals (3 cases)

| # | Kind | Prompt | Expected |
|---|---|---|---|
| 1 | trigger | "Kickoff: let's build the bookings module" | Skill invoked. First action is `product-context`, then a closed alignment question. It flags that bookings is not in the current block (the roadmap's **Blocks** rule names which block is current, and which one bookings sits in) — no plan file written until the owner resolves that. |
| 2 | no-trigger | "The finance report tab shows the wrong month name in Arabic" | Skill NOT invoked (bug on a live module → `docs/modules/finance.md` flow). |
| 3 | output | "Spec a 'staff shifts' module for the current block" (with the owner answering the questions) | Plan file created from the template with a filled **Outcome metric** table (metric, source, baseline, check date), a declared tier, and all three check verdicts; roadmap linked; ends with a closed Gate 1 approval question. |
