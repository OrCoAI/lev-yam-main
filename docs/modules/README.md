# Module logs

One file per live platform module — a running backlog of **bugs and small features**,
separate from the heavier process in `docs/plans/`.

- **`docs/plans/<module>-<initiative>.md`** — for a new initiative: a migration, a new
  cross-module flow, anything that needs the full kickoff in `CLAUDE.md` (alignment
  questions, roadmap/architecture/vision check, its own branch).
- **`docs/modules/<module>.md`** (this folder) — for day-to-day fixes and small,
  self-contained features on a module that's already live. No kickoff ceremony — just log
  it, fix it, close it. See the "Ongoing module work" section in `CLAUDE.md` for the
  process.

Each file has three sections: **Open bugs**, **Open feature ideas**, **Done**. An entry
moves from open to done in place — don't delete history, so the file doubles as a change
log for the module.

If something logged here turns out to need schema changes, new permissions, or touches the
cross-module spine (events/finance) — it's grown into an initiative. Stop, and start a plan
file in `docs/plans/` instead.
