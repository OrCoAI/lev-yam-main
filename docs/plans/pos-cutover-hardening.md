# POS Cut-over & Hardening

**Status: kickoff approved 2026-07-14.** Follows on from
[pos-module.md](pos-module.md) (parity-ready milestone, closed out 2026-07-10). This is
the roadmap's "Parity trial" + "Cut over" line items, both currently unchecked in
[ROADMAP.md](../ROADMAP.md) Phase 1.

## 0. Trigger & gate

- **Parity trial:** owner confirms (2026-07-14) full shifts were worked in `/app/pos`
  alongside `pos.html`, numbers matched `pos_day_report` to the shekel. One gap found and
  fixed separately from this initiative: the first week of July (2026-07-03, 2026-07-04)
  hadn't been posted to finance via `pos.close_day` — backfilled 2026-07-14 (verified in
  `finance.entries`; 07-10/07-11 were already posted, confirming the gap was exactly
  "first week"). This satisfies ARCHITECTURE.md invariant 7 ("cut-over only after parity
  is proven on real service days").

## 1. Scope — decisions locked with the owner (2026-07-14)

Sequencing: **cut-over first, then hardening** (dropping anon policies requires
`pos.html` to no longer depend on anon-key access — the two can't be done independently).
Ships as **one branch/PR**.

1. **Cut-over:** `pos.html` becomes a redirect to `/app/pos`; retire in-file PIN/role
   codes (`RoleModal`, `AppGate` were already dropped from the platform port per
   [pos-module.md](pos-module.md) §5 — this removes the standalone file's copies).
2. **Drop anon policies + grants** from `10_pos.sql` on all four `pos_*` tables (now
   safe — no surface depends on anon access after #1).
3. **`created_by` from JWT** on `pos_expenses` (and `pos_bills.closed_by` where
   client-authored) — trigger defaulting from `auth.uid()`/`auth.jwt()`, replacing the
   client-supplied value. Possible now that the anon (no-JWT) path is gone.
4. **`pos` schema move** — `pos_tables`, `pos_bills`, `pos_bill_items`, `pos_expenses`
   move from `public` into the `pos` schema (closes the "known consolidation debt" in
   ARCHITECTURE.md §5). Views (`v_sales_*`) move with them. All `app-src/src/modules/pos/`
   references (`supabase.from('pos_bills')` → `supabase.schema('pos').from('pos_bills')`
   pattern per `lib/supabase.ts` convention) update accordingly.
5. **Server-side bill recompute — validation only, no menu-data migration.** Menu prices
   stay in `menu.ts`; add a mirrored SQL price map and have `pos_close_table` recompute
   `grand_total`/`extras_total` server-side from that map, rejecting (not silently
   overriding) a mismatched client-submitted total. Closes the forgery hole from
   [pos-module.md](pos-module.md) §8a without a menu-editor UI or admin surface — that
   stays future scope (full menu-as-data).
6. **`pos.range_report(from, to)`** — one DB aggregate RPC replacing the client's
   per-day fan-out (up to 92 RPCs, all-or-nothing, 92-day cap) in the report tab.

**Explicitly out of scope** (per pos-module.md §8a and this session's decisions):
- Waiter vs chef role split (platform "staff" stays chef-level; a new role is cheap
  later if needed).
- Full menu-as-data (owner-editable menu table + admin UI) — only the validation mirror
  ships now.
- Partial payments on `finance.expected` — a finance-module follow-up, not POS.
- Parity-inherited quirks kept deliberately (device-local "today", active-table
  resurrection, range-report all-or-nothing — superseded by #6 for the *aggregation*
  fan-out issue, but the all-or-nothing semantics of a single query naturally apply
  unless the owner wants partial-range results on a mid-range error, which is not
  requested).

## 2. Database plan — `supabase/schema/43_pos_cutover.sql` (new file)

Idempotent, applied after `42_pos_platform.sql`.

- [ ] Drop anon policies from `10_pos.sql`'s four `pos_*` tables and their anon grants
  (`grant ... to anon` revoked).
- [ ] `alter table public.pos_tables set schema pos;` (+ `pos_bills`, `pos_bill_items`,
  `pos_expenses`, and the `v_sales_*` views). Update any hardcoded `public.pos_*`
  references in functions (`pos_close_table`, `pos_reopen_bill`, `pos_mark_item`,
  `pos_day_report`, `pos.close_day`) to the new schema-qualified names, or rely on
  `search_path` — decide per function during implementation.
- [ ] `created_by`/`closed_by` trigger: `before insert on pos.pos_expenses` (and
  `pos_bills` if applicable) sets the column from `auth.uid()`, ignoring/overriding any
  client-submitted value.
- [ ] Price map + recompute in `pos_close_table`: a small `case`/lookup mirroring
  `menu.ts` constants; function raises/rejects on mismatch beyond the existing internal
  consistency checks (`grand = oh + extras − discount`, `cash+card = grand+tip`).
- [ ] `pos.range_report(p_from date, p_to date)` — SECURITY DEFINER, re-checks
  `pos.reports`, aggregates over the date range in one query; grant execute to
  `authenticated` only (no anon path needed post-cut-over).
- [ ] Grants: `authenticated`-only across the board now (no `anon` grants remain on
  `pos.*`).

## 3. UI changes — `app-src/src/modules/pos/`, `pos.html`

- [ ] `pos.html` → static redirect to `/app/pos` (keep the file per the deploy allowlist,
  replace its body, or use a meta-refresh — decide the exact mechanism during
  implementation; must still 200 for the deploy smoke-check).
- [ ] `ReportTab.tsx`: range queries call `pos.range_report` instead of per-day fan-out.
- [ ] `api.ts`: schema-qualify all `pos_*` table access to `supabase.schema('pos')`.
- [ ] No visible UI change for the price-recompute or created_by hardening (server-side
  only); verify existing flows still submit/close bills correctly against the new
  server-side check.

## 4. Invariants carried forward from pos-module.md §6

Unchanged: money math per bill, kitchen ownership split, one finance writer per
category, `close_day` idempotent/correction-only. This initiative adds:

7. No anon access to any `pos.*` table/function after cut-over — `authenticated` +
   `core.has_permission()` is the only path (ARCHITECTURE.md invariant 1).
8. `created_by`/`closed_by` are server-authored, never trusted from the client payload.
9. Bill totals are server-recomputed and rejected on mismatch, not merely
   internally-consistency-checked against a client-supplied number.

## 5. Risks / open questions

- **`pos.html` redirect mechanics:** a hard redirect breaks anyone with the page
  bookmarked/PWA-installed mid-shift if deployed during service hours — deploy at a known
  quiet window, communicate to staff beforehand (operational, not a code question).
- **Schema move + `search_path`:** functions using bare `pos_bills` etc. (not
  `public.pos_bills`) will resolve differently once tables move schemas — audit every
  function in `10_pos.sql`/`42_pos_platform.sql` for this during implementation, don't
  assume `search_path` alone is safe.
- **Price map drift:** the SQL price mirror can drift from `menu.ts` if one is edited
  without the other — until full menu-as-data lands, this is a manual-sync risk to note,
  not solve, in this initiative. A price edit made in only one place **fails closed**
  (blocks table closes for that item) rather than silently under-charging, which is safe
  but is itself an availability bug waiting to happen. Follow-up idea from the `/simplify`
  pass (2026-07-14): a cheap CI check diffing `menu.ts` prices against the SQL literals in
  `pos.menu_price`, short of full menu-as-data — not done in this initiative, log it in
  `docs/modules/pos.md` open feature ideas at close-out.

## 6. Alignment check (kickoff, 2026-07-14)

- **VISION.md:** "Evolution, not revolution... cut-over only after parity is proven on
  real service days" (principle 7) — satisfied, trial confirmed clean. "One login, roles
  decide" (principle 3) — reinforced by removing the last anon/PIN access path.
- **ARCHITECTURE.md:** invariant 1 (RLS is the only real gate) — closes the last
  anon-key exception in the platform. Invariant 7 (live tools keep working until parity
  proven) — gate satisfied per §0 above. §5 Scalability "known consolidation debt" —
  directly resolved by the schema move. No conflicts found between VISION/ROADMAP/
  ARCHITECTURE for this scope.
- **ROADMAP.md:** matches Phase 1's existing (unchecked) "Parity trial" and "Cut over"
  lines verbatim, including the parenthetical hardening list — no phase-jump.

## Close-out (2026-07-15)

**Shipped:** all six scope items from §1, on branch `pos-cutover-hardening`:

1. **Cut-over:** `pos.html` replaced with a `location.replace('/app/pos')` redirect
   (+ meta-refresh and a bilingual HE/AR `noscript` fallback); confirmed live-navigating
   in a real browser and returning `200 OK` (matches `deploy.yml`'s smoke-check).
2. **Anon access dropped:** the four `pos_*` anon RLS policies and grants from
   `10_pos.sql` are gone; verified via REST probes with both the anon key and the
   service-role-equivalent key — every `pos.*` table/function now returns
   "permission denied for schema pos" (schema-level block) with no anon path at all.
3. **`created_by`/`closed_by` from JWT:** one `pos.set_actor_from_jwt()` trigger
   (dispatched on `TG_TABLE_NAME`, collapsed from two near-identical functions during
   `/simplify`) overrides both columns unconditionally from `auth.jwt()->>'email'`.
4. **`pos` schema move:** `pos_tables`/`pos_bills`/`pos_bill_items`/`pos_expenses` +
   the four `v_sales_*` views moved from `public`; the schema-move statements were
   made idempotent (guarded with `pg_tables`/`pg_views` existence checks) after the
   first `/simplify` pass, since the migration had to be re-applied twice more
   (once for `/simplify` fixes, once for a `/security-review` fix — see below).
5. **Server-side bill validation (validation only, no menu-as-data):** per-item price
   check against a hardcoded `pos.menu_price()` mirror of `menu.ts`, an open-house
   charge recompute (`pos.oh_charge()`), **and** — added during `/security-review`
   after the first cut was found incomplete — an `extras_total` cross-check summing
   the validated line items. Custom items remain the documented no-price-check escape
   hatch.
6. **`pos.range_report(from, to)`:** one aggregate RPC (sharing a `pos.report_for_range`
   core with the single-day report) replacing the client's per-day fan-out; verified
   live in the browser (7-day preset rendered correct aggregates, zero errors).

**Gate outcomes:**
- `/simplify`: merged duplicate triggers, fixed a double `menu_price()` evaluation,
  reordered `pos.report_for_range` to skip queries entirely for unauthorized fields
  instead of compute-then-redact, made the schema move idempotent, removed dead
  `created_by`/`byName` client plumbing. One reuse suggestion (reconciling with
  `finance.report`'s RLS-scoping pattern) explicitly skipped as out of scope/too risky
  for this migration.
- `/code-review high`: the 8-agent multi-agent pass hit the session usage limit and
  every finder agent failed before reporting; completed the review manually instead
  (found + fixed a missing dev-mock handler for the new `range_report` RPC, and two
  stale doc references to POS still living in `public` schema).
- `/security-review`: caught a real High-severity gap — the first cut of
  `pos_close_table` validated per-item prices and the open-house charge but never
  summed the validated items against `extras_total`/`grand_total`, so a `pos.order`
  holder could still submit a self-consistent forged total. Fixed (item 5 above) and
  re-verified structurally.
- `/verify`: full browser pass via Playwright in the app's own `?preview` dev-mock
  mode (floor view, 7-day range report, add-item → payment → close-bill flow, cash
  total updating live, kitchen view) plus a static-server test of the `pos.html`
  redirect. All clean. **Not covered:** a live browser test against the real,
  corrected `pos_close_table` SQL (preview mode's mock doesn't replicate that
  validation) — confirmed structurally instead (function resolves correctly after
  each re-run) and by hand-tracing the logic against `buildBillPayload`'s computation.
- **Operational, done alongside but outside this diff:** backfilled two missing
  `pos.close_day` postings for 2026-07-03/07-04 (found during kickoff, unrelated to
  POS code — the first week of July's parity-trial days hadn't been posted to
  finance yet).

**Alignment verdict:** ✅ Aligned, matching the kickoff check in §6 — nothing found
during implementation changed that verdict. VISION.md principle 7 ("cut-over only
after parity is proven") and principle 3 ("one login, roles decide") both satisfied.
ARCHITECTURE.md invariant 1 (RLS + JWT is the only gate) and the §5 "known
consolidation debt" are both resolved by this migration — `ARCHITECTURE.md` and
`supabase/README.md` updated to drop the now-stale "lives in `public` until migrated"
language.

**Deliberately left out (per locked scope):** full menu-as-data (owner-editable menu
table + admin UI) — logged as an open feature idea in `docs/modules/pos.md`. A
follow-up CI check diffing `menu.ts` prices against `pos.menu_price()`'s SQL literals
was also identified (`/simplify`) but not built — same open-feature-ideas entry.
