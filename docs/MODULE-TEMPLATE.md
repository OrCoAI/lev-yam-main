# How to add a module

The repeatable recipe for adding a module to the platform (`/app`), extracted from the
**quotes migration** (2026-07, the first one — see [plans/quotes-module.md](plans/quotes-module.md)).
POS is next and should follow this checklist; update the doc whenever a migration teaches
something new.

A module is **five registrations plus a folder**: a Postgres schema, seed rows
(`core.modules` + permissions), a permission-key mirror, a route, and a launcher
destination. Everything else is the module's own UI.

## 0. Before writing code

- [ ] Write the plan: `docs/plans/<module>.md`, linked from the
  [ROADMAP](ROADMAP.md) phase item. Name the invariants that must hold (the quotes plan's
  "one contract per quote / signed is immutable" list is the model) — those become DB
  triggers, not UI checks.
- [ ] If migrating an existing tool: **back up the source first** (private repo — real
  data never enters this public repo), and keep the old tool running until the parity bar
  is met. Define that bar in the plan (for quotes: a real record through its full life +
  a printed A4 identical to the old output).
- [ ] **Answer the two spine questions** (design:
  [plans/cross-module-foundation.md](plans/cross-module-foundation.md)):
  1. *What does this module project into `events`?* Anything with a date on the shared
     calendar goes through a SECURITY DEFINER trigger upserting `events.events` on
     `(source_module, source_id)` — plus a `backfill_events()`-style function. Rows whose
     title carries PII are always `visibility='internal'` (see quotes' projector in
     `40_events.sql` — the reference implementation).
  2. *What does it post into `finance`, under which posting rule?* Money writes go through
     a posting function that sets the `levyam.finance_posting` GUC and carries provenance
     (`source_module`/`source_ref`, optional `event_id`); pick the granularity in the plan
     (quotes: per payment via `finance.expected`; POS: per-day summary at `close_day`).
     Any category the module posts becomes **derived-only** — remove it from manual entry
     in the finance UI, or the same money gets typed twice.

## 1. Database — `supabase/schema/NN_<module>.sql`

- [ ] **One file, one Postgres schema per module.** `NN` follows *build order*, not
  alphabet (core 00, pos 10, finance 20, quotes 30, …).
- [ ] **Idempotent throughout** — `create … if not exists`, `create or replace`,
  `drop policy if exists` before `create policy`, seeds with `on conflict do nothing`.
  The file is re-run in the Supabase SQL editor after every change; nothing may reset
  live state (e.g. quotes' number sequence survives re-runs via `if not exists`).
- [ ] **Invariants live here as triggers**, with **HE+AR** user-facing `raise exception`
  messages (they surface in the UI — same bilingual invariant as everything user-facing,
  ARCHITECTURE.md §2 invariant 5). UI enforcement is convenience only.
- [ ] **RLS on every table**, policies via `core.has_permission('<module>.<action>')`.
  Standard split: a `view` permission for `select`, finer actions for writes. Extra-
  sensitive data (quotes' owner signature) goes in its **own table** so RLS can gate it
  more strictly.
- [ ] **Wrap policy calls as `(select …)`** — always
  `using ((select core.has_permission('x')))` and `user_id = (select auth.uid())`,
  never the bare call: the wrapper makes Postgres evaluate it **once per statement**
  (InitPlan) instead of once per row (H4 sweep, 2026-07-15 — all existing policies use
  this form; `explain` should show an InitPlan node, not a per-row Filter re-eval).
  The one legitimate exception is a predicate that genuinely depends on the row, like
  `pos_expenses`' `core.has_permission('pos.costs_' || kind)` — leave those bare and
  comment why.
- [ ] **Grants to `authenticated` only** by default (RLS still gates every statement);
  admin/import work runs through the Supabase management API instead (see §6).
  **Exception:** an Edge Function that must write on its own (not a one-time import) gets
  narrow, explicit, function-scoped grants — exactly the tables/functions it needs, never
  a schema-wide grant — documented inline next to the grant (`01_passkeys.sql`'s
  `passkeys`/`webauthn_challenges` grants for `passkey-verify`; `00_core.sql`'s
  `admin_assign_role`/`has_permission_for` grants for `admin-invite` are the two
  precedents). If the function is `security definer` and trusts an argument instead of
  re-checking permissions itself (like `admin_assign_role` trusts its caller already
  checked `users.manage`), explicitly `revoke execute ... from authenticated` right after
  the schema's blanket `grant execute on all functions … to authenticated` — otherwise
  any signed-in user can call it directly via RPC and bypass the check entirely.
- [ ] `security definer` functions must `set search_path` and re-check permissions
  inside (see `quotes.auto_expire`).
- [ ] **Seeds at the bottom of the same file:** a `core.modules` row (key, label, icon,
  sort), `core.permissions` rows (`<module>.<action>` + Hebrew label), and
  `core.role_permissions` grants per role.
- [ ] Apply: run the file in the SQL editor, then add the schema under
  **Supabase → Settings → API → Exposed schemas**. Verify from outside: an anon REST call
  should return `42501` (denied) — not `PGRST106` (not exposed).
- [ ] **Extend + run the RLS suite:** add the new tables' can/can't assertions to
  `supabase/tests/rls_matrix.sql` (every role that must NOT see/write them, plus anon),
  then paste-run the whole suite in the SQL editor — it must end
  `RLS MATRIX: ALL ASSERTIONS PASSED` (it rolls itself back; prod-safe). A schema apply
  without a green suite run is an unfinished apply.

## 2. Platform registration (four small edits)

- [ ] `app-src/src/lib/permissions.ts` — add the permission keys to `PERM` (constants,
  never string literals in module code).
- [ ] `app-src/src/App.tsx` — route(s) under the `RequireAuth`/`Layout` tree, wrapped in
  `<RequirePermission perm={PERM.<module>View}>`. Sub-pages (like `quotes/:id`) are
  separate routes behind the same view permission.
- [ ] `app-src/src/shell/Launcher.tsx` — add **one `MODULE_META` entry** for the module:
  route (`to: '/<module>'`; a not-yet-migrated external tool uses `href`), a brand icon
  (shared brand art from `/app/brand/`, no emoji/icon fonts — the `core.modules` emoji is
  only the fallback), and a `descKey` pointing at a bilingual one-line "what's inside"
  description added to the shell dict (`lib/i18n.tsx`, `launcher.desc.<module>`). The
  tile itself appears automatically via `core.my_modules()` once the seed row exists.
- [ ] No deploy config needed — `/app` is built and published as a whole. (Only *new
  public static files* outside the app need the `deploy.yml` allowlist.)

## 3. The module folder — `app-src/src/modules/<module>/`

Anatomy proven by quotes (adapt, don't cargo-cult):

| File | Role |
|---|---|
| `types.ts` | Row shapes exactly as PostgREST returns them; jsonb payload interfaces |
| `api.ts` | All data access; components never call supabase directly |
| `i18n.ts` | Module-local HE+AR dictionary for module *chrome*: two parallel typed objects through `makeDictHook(he, ar)` from `lib/i18n.tsx` (see `finance/i18n.ts` — the canonical shape) |
| `<Module>Module.tsx` | Dashboard/entry route |
| `*.css` | **Every class prefixed with the module's letter(s)** (`q-…`) |
| `defaults.ts` etc. | Ported template/default data, kept verbatim from the source tool |

Rules that came from real bugs:

- **Namespace all module CSS.** Quotes' `.seg` collided with finance's `.seg` in the
  bundled build and broke layout in a way dev didn't show.
- **Assert every write.** PostgREST answers `204` with no error when RLS filters out all
  target rows — a denied UPDATE/DELETE looks like success. Append `.select('id')` and
  throw when zero rows come back (see `assertWritten` in quotes' `api.ts`); surface a
  bilingual message.
- **Document content ≠ UI chrome.** Customer-facing business documents stay Hebrew
  as-entered (they're data); only module chrome is bilingual.
- **RTL specifics:** scaled/absolutely-positioned sheets need `transform-origin: top
  right`; LTR runs like `10:00–16:00` need `<bdi>`/`dir="auto"`; popover menus render via
  `createPortal(document.body)` so ancestor transforms can't clip them.
- **Mobile-first is a requirement, not polish** — test at 390px width first. The
  platform phone breakpoint is **640px**, defined once as `PHONE_MQ`
  (`lib/useMediaQuery.ts`) and mirrored by the `@media (max-width: 640px)` blocks in
  `styles.css` — new modules use those two, never a third number. (Quotes' 760px is a
  sanctioned module-local exception: its wide dashboard table needs the room.)
- **Phone list rows use the shared `.rowline` disclosure system** (styles.css) — one-line
  summaries that expand to full detail, so no field is ever amputated on mobile. The
  contract:
  - wrapper: `className="card rowline"` around the `<table className="grid">`;
  - one cell per role: `.rl-lead` (leading muted context, e.g. date), **exactly one**
    `.rl-main` (flexible, ellipsized), `.rl-amt` (trailing figure), optional `.rl-tail`
    (trailing muted count);
  - every remaining field is `.rl-more` **with a `data-label`** (it becomes the visible
    label when expanded; an empty cell hides itself — render `''`, never placeholder
    text);
  - actions go in one `.rl-actions` cell — full-width ≥44px buttons when expanded; a row
    that must not be edited explains itself with a `.rl-lock` span there instead;
  - spread `{...rowProps(id)}` from `useRowDisclosure()` (`lib/useRowDisclosure.ts`) on
    each expandable `<tr>` — rows without it (pure breakdowns) stay one line, no chevron;
  - rows that must also expand on **desktop** (drill-downs, e.g. the finance report's
    breakdown tables) use `useRowDisclosure({ allViewports: true })` and render a
    trailing `<td className="rl-chev"><span className="chev" /></td>` as the desktop
    affordance (hidden on phones, where the row's own ::after chevron shows);
  - an inline form belongs in a `<tr className="rl-formrow"><td colSpan={n}>` directly
    under its row (see ExpectedTab's record-payment form);
  - a big always-open form collapses behind a `.form-open-btn` primary button on phones:
    `useState(!isPhone)`, open it on edit, close it after a phone save (see EntriesTab).
- **Printable A4 documents:** load the `a4-fit` skill before touching them; keep both fit
  mechanisms (screen scale + print scaleY) and verify page count through the real print
  pipeline (headless Chrome `page.pdf`).

## 4. Verifying without credentials

Dev-only preview harness (built for quotes, reusable): `?preview` on any `/app` route in
`npm run dev` boots `src/dev/mock-net.ts` *before* app modules — fake session in
localStorage + fetch interception with in-memory fixtures. The authed UI runs with zero
network and is tree-shaken from prod builds.

- [ ] Add fixtures for the new module's tables to `src/dev/fixtures.ts`.
- [ ] Screenshot phone-width via puppeteer/playwright-core + system Chrome; for printable
  docs, count PDF pages.
- [ ] `npm run build` locally; `ci.yml` runs typecheck+build on branch pushes, so open
  work on a `feat/<module>` branch and merge to `main` only green (main deploys straight
  to production, smoke-checked post-deploy).

## 5. Permissions sanity pass

- [ ] Every write path in the UI is gated with `useCan`/`RequirePermission` **and** the
  matching RLS policy exists — walk each `PERM.<module>*` key both ways.
- [ ] Viewer-role UX: read-only users get disabled/readOnly affordances, not errors
  (quotes: settings gear hidden, checklist modal readOnly).

## 6. One-time data import (when migrating a real tool)

The quotes import is the worked example (`docs/plans/quotes-module.md` §6):

- **Customer data never enters this repo** — import scripts run from a local scratchpad;
  commit only the *pattern notes* to the plan doc.
- Run SQL through the management API: `POST
  /v1/projects/<ref>/database/query` with the Supabase CLI token (macOS keychain,
  `security find-generic-password -s "Supabase CLI" -w`). A multi-statement query is one
  transaction — an error rolls back everything. `service_role` has no grants on module
  schemas, so PostgREST is not an import path.
- Purge dev/test rows first (mind guard triggers: disable/re-enable around legitimate
  admin ops on trigger-protected rows).
- Preserve identifiers, dates and status stamps exactly; check sequences/counters against
  the source's next-number.
- Legal/immutable documents: snapshot to a **private** Storage bucket (`quotes-docs`
  pattern: PDF via headless Chrome + the original HTML), record the path on the row.
- Parity-check in SQL (counts, statuses, money rollups vs. the old tool) before cut-over;
  then mark the source tool archived (banner in its README/CLAUDE.md, final push to its
  private backup repo).

## 7. Close the loop

- [ ] Tick the ROADMAP item; update the plan doc to "as-executed".
- [ ] Update this template with anything the migration taught.
