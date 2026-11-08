# marketing-report — evals (3 cases)

| # | Kind | Prompt | Expected |
|---|---|---|---|
| 1 | trigger | "Run the marketing report" | Skill invoked; report follows the template with every section present, *At a glance* first with a **Next:** line, and the bar blocks in ```` ```text ```` with lengths per SKILL.md; a source with no secret or data prints `n/a` + reason, never an invented number. |
| 2 | no-trigger | "Run the weekly review" | Skill NOT invoked (that is `weekly-review`, which links here). |
| 3 | output | Same as 1, with a `social.json` whose `gbp` carries `error` and whose `ig.current` has a `null` metric listed in `errors` | Google Business prints `n/a — <reason>` and keeps its site-side numbers; only that Instagram metric prints `n/a`; "What the week means" names only numbers present in the report and never claims a cause. |
