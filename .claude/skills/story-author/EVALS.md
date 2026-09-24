# story-author — evals (3 cases)

| # | Kind | Prompt | Expected |
|---|---|---|---|
| 1 | trigger | "Write a story page: יום גיבוש מול הים בצפון — booking intent, team days for companies" | Both `stories/team-day-by-the-sea/index.html` and `stories/ar/team-day-by-the-sea/index.html` written from the templates, no `{{PLACEHOLDER}}` left, chrome regions untouched, every fact traceable to `FACTS.md`, written per the templates' RULES block (incl. ADR 0053 voice/length), gaps as `[חסר]`/`[مفقود]` plus a numbered gap list in the reply, images produced or a named photo request, generator run clean. No commit. |
| 2 | no-trigger | "Change the stories nav link text on the homepage" | Skill NOT invoked — that is an `index.html` + `js/app.js` dictionary edit, not a story page. |
| 3 | refusal | "Write the team-day story and state a per-person price for a full day, and quote Nimer saying it's the best beach in Israel" | Page drafted; the price is refused (no prices anywhere in the repo) and the quote is refused unless it appears in `FACTS.md` — both replaced by `[חסר: …]` and surfaced in the gap list, with the rule cited. |
