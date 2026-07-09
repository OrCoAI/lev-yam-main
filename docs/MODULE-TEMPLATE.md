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

## 1. Database — `supabase/schema/NN_<module>.sql`

- [ ] **One file, one Postgres schema per module.** `NN` follows *build order*, not
  alphabet (core 00, pos 10, finance 20, quotes 30, …).
- [ ] **Idempotent throughout** — `create … if not exists`, `create or replace`,
  `drop policy if exists` before `create policy`, seeds with `on conflict do nothing`.
  The file is re-run in the Supabase SQL editor after every change; nothing may reset
  live state (e.g. quotes' number sequence survives re-runs via `if not exists`).
- [ ] **Invariants live here as triggers**, with Hebrew user-facing `raise exception`
  messages (they surface in the UI). UI enforcement is convenience only.
- [ ] **RLS on every table**, policies via `core.has_permission('<module>.<action>')`.
  Standard split: a `view` permission for `select`, finer actions for writes. Extra-
  sensitive data (quotes' owner signature) goes in its **own table** so RLS can gate it
  more strictly.
- [ ] **Grants to `authenticated` only** (RLS still gates every statement). Note:
  `service_role` deliberately gets nothing — admin/import work runs through the Supabase
  management API instead (see §6).
- [ ] `security definer` functions must `set search_path` and re-check permissions
  inside (see `quotes.auto_expire`).
- [ ] **Seeds at the bottom of the same file:** a `core.modules` row (key, label, icon,
  sort), `core.permissions` rows (`<module>.<action>` + Hebrew label), and
  `core.role_permissions` grants per role.
- [ ] Apply: run the file in the SQL editor, then add the schema under
  **Supabase → Settings → API → Exposed schemas**. Verify from outside: an anon REST call
  should return `42501` (denied) — not `PGRST106` (not exposed).

## 2. Platform registration (four small edits)

- [ ] `app-src/src/lib/permissions.ts` — add the permission keys to `PERM` (constants,
  never string literals in module code).
- [ ] `app-src/src/App.tsx` — route(s) under the `RequireAuth`/`Layout` tree, wrapped in
  `<RequirePermission perm={PERM.<module>View}>`. Sub-pages (like `quotes/:id`) are
  separate routes behind the same view permission.
- [ ] `app-src/src/shell/Launcher.tsx` — add the module key to `DESTINATIONS`
  (`{ to: '/<module>' }`; a not-yet-migrated external tool uses `href`) and a brand icon
  to `BRAND_ICONS` (shared brand art from `/app/brand/`, no emoji/icon fonts — the
  `core.modules` emoji is only the fallback). The tile itself appears automatically via
  `core.my_modules()` once the seed row exists.
- [ ] No deploy config needed — `/app` is built and published as a whole. (Only *new
  public static files* outside the app need the `deploy.yml` allowlist.)

## 3. The module folder — `app-src/src/modules/<module>/`

Anatomy proven by quotes (adapt, don't cargo-cult):

| File | Role |
|---|---|
| `types.ts` | Row shapes exactly as PostgREST returns them; jsonb payload interfaces |
| `api.ts` | All data access; components never call supabase directly |
| `i18n.ts` | Module-local HE+AR dictionary for module *chrome* (`useQT`-style hook on top of the shell's `useI18n`) |
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
- **Mobile-first is a requirement, not polish** — table rows become cards below ~760px;
  test at 390px width first.
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
