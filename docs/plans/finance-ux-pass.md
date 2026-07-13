# Finance UX pass — informative report, source links, HE/AR retrofit

**Status:** in progress (kickoff 2026-07-12)
**Branch:** `finance-ux-pass`

## Why now

Or asked (2026-07-12, explicit brief — treated as the kickoff alignment; open questions
listed below rather than blocking, session ran autonomously):

1. **Report ("summary") tab more informative** — each breakdown item expandable with
   more information; filters and relevant views available by default; date filters
   redesigned to the platform's mobile patterns.
2. **Transactions tab** — module-posted ("imported") entries link back to their source
   so an edit/correction happens where it's allowed (derived rows are immutable in
   finance by design).
3. Plus whatever else is relevant — picked from the tracked *Finance follow-ups*
   roadmap bullet, not invented: the **HE/AR retrofit** of the finance chrome (platform
   invariant; the module predates the i18n layer) and the **EntriesTab form → child
   component** perf fix (keystrokes re-render the whole list).

## Scope

### Report tab (דוח)
- **Date range presets** as chips (today / 7 days / this month / last month / this
  year) with active-state detection, mirroring the POS report's preset pattern; the
  two `DateField`s collapse behind a "custom range" chip (mobile pattern: chips are
  the platform's compact-choice control; two always-open date inputs were the clunky
  part). Picking a preset closes the custom row.
- **Kind filter** (all / income / expense) as a segmented control, filtering both
  breakdown tables.
- **Expandable breakdown rows**: every by-category and by-payment row toggles open
  (desktop chevron cell + phone chevron via the `.rowline` pattern) to show the
  underlying entries in-range — date, note, source badge, payment method, signed
  amount, and the row's share of its side's total. Data: one extra `finance.entries`
  range query per range change (client-side grouping; report totals still come from
  the `finance.report` RPC — the DB stays the source of truth for the numbers).
- Stat cards gain the entry count under each total.

### Transactions tab (תנועות)
- **Source links** for module-posted rows, resolved from real provenance formats:
  - `pos` + `pos:<date>:<leg>[:rN]` → `/pos?report=<date>` (new deep link, below);
  - `quotes` + `expected:<uuid>` → resolve via a one-shot `finance.expected` fetch
    (id → its `source_ref` = `<quote_uuid>:deposit|:balance`) → `/quotes/<quote_uuid>`;
  - `finance` + `expected:<uuid>` (payment on a hand-created expectation) → no page
    to link; the lock explainer stays.
  The link renders as a button in the row's actions area (next to the lock note) and
  the provenance badge itself becomes the same link where resolvable. ExpectedTab
  quotes rows (`<quote_uuid>:deposit|:balance`) link directly too.
- **Kind filter** (all / income / expense) — server-side (`.eq('kind', …)`), resets
  paging.
- **EntryForm extracted** to a child component owning its keystroke state (same
  pattern as ExpectedTab's `FulfillForm`) — tracked follow-up.

### POS module (small, enabling)
- `/pos?report=<date>`: `PosModule` reads the search param for *initial* state only —
  opens the day report at that date (`ReportView` gets an optional `initialDate`).
  Guarded to `YYYY-MM-DD`; no state↔URL sync beyond mount.

### HE/AR retrofit (roadmap follow-up, tracked)
- All finance chrome moves into `modules/finance/i18n.ts` via `makeDictHook` —
  tabs, forms, table headers, confirms, errors, empty states — plus the label maps
  (categories, payment methods, statuses, sources, reasons) moving out of
  `categories.ts` (which keeps the lists + derived-only logic only).
- `SourceBadge` becomes dictionary-driven.

### Dev harness
- `mock-net.ts` `matches()` learns `gte.`/`lte.` (the drill-down range query).
- Finance fixtures corrected to the **real** provenance formats (`expected:<uuid>`,
  `<quote_uuid>:deposit|:balance`) so the preview exercises the links; a fixture
  quote id matches so the link resolves in preview.

## Not in scope
- No schema / RLS / permission changes — read paths only, all already covered by
  `finance.view` RLS. `supabase/schema/` untouched.
- Partial payments on `finance.expected` and the finance-source reversal path
  (separate follow-ups, stay on the roadmap).
- Charts/graphs on the report (candidate for Dashboards v2).
- Bilingual DB module labels (`core.modules`) — separate tracked follow-up.

## Architecture invariants check
- Permissions DB-first: no new write paths; reads ride existing RLS. UI gating
  unchanged (`useCan(financeManage)` for actions).
- Schema source of truth: no schema change.
- Cross-module spine: source links *strengthen* the spine (provenance becomes
  navigable); no module-local money silos introduced.
- Bilingual HE/AR: this pass retrofits the module to the invariant.
- Mobile-first: chips/segmented/disclosure patterns; drill-down works at phone width.

## Vision check
Serves "one platform, staff work from phones" and the money spine: the owner can
answer "what's inside this number?" from the report and jump from a posted row to
the tool that owns it. No conflicts found with VISION.md / ROADMAP.md.

## Open questions (flagged, non-blocking)
- Preset set chosen (today/7d/this month/last month/this year) — adjust to taste.
- The report drill-down caps at 1000 entries per range (soft warning shown) —
  fine at current volumes; server-side pagination there is a later need.
