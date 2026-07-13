# Finance UX pass — informative report, source links, HE/AR retrofit

**Status:** done — PR [#6](https://github.com/OrCoAI/lev-yam-main/pull/6) (close-out below)
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

## Close-out (2026-07-13)

**Shipped** (PR [#6](https://github.com/OrCoAI/lev-yam-main/pull/6), branch `finance-ux-pass`, CI green; production once merged):

- **Report tab**: date-preset chips (today / 7 days / this month / prev month /
  this year) with active detection + a collapsible custom range and an
  always-visible range caption; all/income/expense segmented filter; stat
  cards with entry counts; **every breakdown row expands** into the entries
  behind its number (date, note, source badge+link, payment method, signed
  amount, share-of-side) — desktop via a `.rl-chev` cell, phones via the
  rowline disclosure. Totals stay `finance.report`-RPC-authoritative; the
  drill-down is one ≤1000-row range query with truncation surfaced in the UI.
- **Transactions tab**: module-posted rows link to their source — quotes refs
  resolve through a batched `expected→quote` map (`provenance.ts`
  `useQuoteMap`, fetches only the ids on screen), POS refs deep-link to
  `/pos?report=<date>`; locked rows show "מעבר למקור" next to the
  immutability explainer; kind filter (server-side, paging-safe); EntryForm
  extracted (keystrokes no longer re-render the list; epoch-keyed remount
  after insert prevents stale-value double submits).
- **POS**: honors `?report=YYYY-MM-DD` (initial state only); the deep-link
  contract (`posReportHref` + `REPORT_DATE_RE`) lives in `pos/logic.ts` so
  producer and consumer can't drift.
- **Platform**: `useRowDisclosure` gained `allViewports` (desktop drill-downs
  ride the shared mechanism incl. its interactive-child guard) — documented
  in MODULE-TEMPLATE §3; shared chevron CSS in the disclosure section.
- **HE/AR retrofit** (tracked follow-up, done): the whole finance chrome +
  category/payment/status/source/reason label maps live in the module
  dictionary; enum maps are `satisfies`-exhaustive against the DB mirrors.
- **Dev harness**: mock-net `gte/lte` (numeric-or-date compare); fixtures use
  the real provenance ref grammars with pinned quote ids so `?preview`
  exercises the links end-to-end.

**Schema/permission changes applied:** none — read paths only, existing
`finance.view`/`finance.manage` RLS governs everything new.

**Decisions along the way:**
- Client-side `source_ref` parsing accepted as the interim mechanism; a
  server-side view/generated-columns follow-up is on the roadmap for when a
  second surface needs the resolution.
- Preset ranges recompute per render on purpose (midnight-safe); the
  `?report=` param is initial-state-only on purpose (no URL↔state sync).
- Kind filtering is server-side on the entries tab (pagination) and
  client-side on the report (breakdowns arrive complete) — deliberate.

**Deliberately left out:** partial payments + finance-source reversal path
(pre-existing roadmap follow-ups); charts (Dashboards v2); debouncing the
custom-range queries (two small requests; empty-value guard added instead).

**Gate:** `/simplify` (4 agents, all applied) → `/code-review high` (8 angles,
10 verified findings all fixed — incl. a desktop duplicate-insert regression
and dead quote links in the report drill-down) → `/security-review` (no
findings) → `/verify` (26 browser checks + 9 adversarial probes, phone +
desktop, HE + AR, `?preview` harness).

**Alignment verdict:** delivered result checked against `docs/VISION.md` and
`docs/ARCHITECTURE.md` — **aligned, no drift**. Permissions stay DB-first (no
new write paths), no schema changes outside `supabase/schema/`, money
provenance became *navigable* across the spine rather than siloed, bilingual
HE/AR is now fully met by this module (it previously violated the invariant),
and every new surface was designed and verified phone-first.
