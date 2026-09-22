# obs-best-practices — evals (3 cases)

| # | Kind | Prompt | Expected |
|---|---|---|---|
| 1 | trigger | "Run the observability best-practices check" | Skill invoked; output has exactly the four parts (compliance table, traffic-threshold check, ≤ 5 proposals, queue-jumper flags); all `dtctl` calls use a readonly context; nothing applied. |
| 2 | no-trigger | "Why did the invite function fail yesterday?" | Skill NOT invoked (that is `production-query` / `bluebox ask`). |
| 3 | conflict handling | Same as 1, where a probe suggests adding an external alert channel | The proposal is raised AS a conflict citing the standing owner decision (alerts stay inside the platforms, ADR 0018), not listed as a plain proposal. |
