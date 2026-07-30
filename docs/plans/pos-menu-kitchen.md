# POS menu-as-data + kitchen reliability — initiative plan

Owner-directed batch on the live POS module (`/app/pos`), aligned with the owner
question-by-question 2026-07-28. This **completes and expands PR D** of
[pos-operations-v2.md](pos-operations-v2.md) (menu-as-data was the last open PR of that
program) and folds in three kitchen/floor fixes that were not part of it.

Module: `app-src/src/modules/pos/`. Schema: `supabase/schema/10_pos.sql`,
`42_pos_platform.sql`, `43_pos_cutover.sql`, `47_pos_payments.sql`, `48_pos_day_lifecycle.sql`.
Module log: [../modules/pos.md](../modules/pos.md).

## Why (vision + roadmap fit)

- **Roadmap:** closes the last open line of *POS operations v2* (PR D — menu-as-data) in
  [../ROADMAP.md](../ROADMAP.md), and hardens the live POS. Menu-as-data also **feeds
  Phase 4** (QR digital menu "sourced from POS items") and **Phase 5** (inventory linked to
  POS menu items) — the menu tables designed here are the same ones those readers consume.
- **Vision:** strengthens the *Operate* backbone (run the venue) and makes the menu
  **owner-editable from the app without a deploy** — the "owner-editable settings live in the
  DB" flexibility principle (VISION §Principles 2, ARCHITECTURE §6).

## Scope — six workstreams

The six owner requests, and the one-line intent of each:

| # | Request | Surface | Schema? |
|---|---|---|---|
| 1 | **Retire "open house"** going forward (keep all history) | menu + floor + logic | columns kept, no DDL drop |
| 2 | **Editable menu** (menu-as-data; meals first-class w/ components) | new `pos.menu_*` tables + admin UI | **yes (new)** |
| 3 | **Kitchen dish filters** — filter by individual dish incl. meal components, multiple at once, device-local | `ChefView` | no |
| 4 | **Realtime reliability** — kitchen stops getting stuck | `usePosData` + publication | **yes (publication)** |
| 5 | **Per-unit kitchen "done"** — one tap = one item | `ChefView` + `pos_mark_item` | **yes (RPC)** |
| 6 | **Floor grid** — equal-height / responsive cards with many tables | `PosModule` + `styles` | no |

### Locked decisions (owner, 2026-07-28)

- **#1 open house = retire going forward, preserve history.** New tables are always
  à-la-carte; remove the `useOH` toggle, `OH` cover prices, and the per-category `oh` concept
  from the live floor and from `tableTotals`. **Do NOT** drop `pricing_mode` / `oh_charge` /
  `is_open_house` columns or rewrite any historical bill — past days, reports, and finance
  postings stay byte-for-byte. Server code that reads `pricing_mode='open_house'` stays (a
  reopened legacy bill must still settle correctly); new bills simply always send
  `a_la_carte`. This keeps the finance spine and history invariant (ARCHITECTURE §7.4/§7.7).
- **#5 per-unit done = one tap marks one unit ready** (a ×3 line needs 3 taps); undo removes
  one unit. `pos.pos_mark_item` changes from *set `done = sent`* to a **±1 delta**, still read
  server-side so it never clobbers a waiter editing the same table.
- **#3 kitchen filters = by individual dish, multiple active at once, device-local**
  (localStorage per screen). A filter must also match the **component dishes inside a meal**
  (e.g. "fish" shows the fish portion of a fisherman's meal). Meal lines already carry their
  chosen `components` on the order line, so the match is client-side (dish name **or** any
  component name); the editable menu supplies the pickable dish list.
- **#2 menu = data, meals first-class.** Categories + flat items + prices + HE/AR become
  owner-editable rows; the `pos.menu_price()` literal mirror is retired (single source of
  truth in the DB). Meals stop being opaque: each meal defines its **fixed components** and
  its **choice slots** (main / salad / pastry), so the kitchen can see and filter on them.
- **Add-ons = separate items** (owner choice): `תוספת ביצה` ₪5 and `תוספת זיתים` become their
  own small menu buttons a waiter taps alongside a dish. No per-item modifier engine this pass.
- **Drinks stay sellable in a POS-only category.** Hot drinks are off the printed August menu
  but still charged at the venue → carried into a `pos_only` (not-on-printed-menu) category so
  no current sale loses its button.
- **Salad-of-choice in meals = all 4 salads** (כרוב · טבולה · ירקות · ג׳רג׳יר). Pastry-of-choice
  (chef meal) defaults to the three taboon pastries — confirm at build.

### Explicitly out of scope

- No per-item **modifier engine** (add-ons are plain items this pass).
- No **rewrite of historical open-house bills**; no drop of the open-house columns.
- No change to the **finance posting / day-lifecycle** money math (PR C/E stay as shipped).
- No **QR / public menu** surface yet (Phase 4) — but the menu tables are designed so it can
  read them later without a reshape.

## The new menu (August 2026) — the seed data

Source: owner-supplied `תפריט לב ים - אוגוסט 2026.pdf` (2026-07-28). Prices/HE/AR captured and
owner-confirmed. **Printed** categories: פתיחים וסלטים, מהים (new), הממולאים של אסרא (new),
מאפים מהטאבון, מתוקים, ארוחות. **POS-only** category: שתייה (drinks, carried over).

Notable deltas from the code menu (`menu.ts`): many price rises; new items (סלט ירקות,
סלט ג׳רג׳יר, החומוס של רמי, שרימפס, פיתה בעבודת יד, עוגיות בעבודת יד); `תוספות` retired
(דג→מהים, צ׳יפס→פתיחים); **hot-drinks category removed from print** (kept POS-only);
meals grew 2→4 with explicit choice slots. Full item/price table + meal compositions live in
the conversation kickoff and will be encoded verbatim in the seed migration.

**Meals & components (drives the kitchen filter):**

| Meal | ₪ | Fixed components | Choice slots |
|---|---|---|---|
| ארוחת בוקר של הדוקטור | 65 | פיתה, לבנה, טחינה | main: שקשוקה \| חביתה · salad: 1 of 4 |
| ארוחת חומוס | 52 | מנת חומוס, סלט ירקות, טחינה וחמוצים | — |
| ארוחת השף | 75 | מיקס ממולאים, טחינה וחמוצים | salad: 1 of 4 · מאפה: 1 of 3 |
| ארוחת הדייג | 110 | מנת דג, צ׳יפס | salad: 1 of 4 |

## Design

### Schema (menu-as-data) — `supabase/schema/51_pos_menu.sql` (new; **built + applied to local 2026-07-28**)

New `pos` tables (RLS on all; read = `pos.order`+, write = new `pos.menu` permission):

- `pos.menu_categories` — `id, name_he, name_ar, sort, kitchen_relevant bool, pos_only bool
  (off printed menu), active bool`.
- `pos.menu_items` — `id, category_id, name_he, name_ar, price numeric, sort, is_addon bool,
  active bool`, timestamps + `created_by`/`updated_by` from JWT (trigger, like the other pos
  tables). Flat items and add-ons live here.
- **Meal composition** — a meal is a `menu_items` row with `is_meal` set; its makeup is
  **document-shaped**, so it lives as `composition jsonb` on the row (fixed components + choice
  slots + option lists), mirroring today's `ComboDef`. *(Open question O1: relational
  component tables vs jsonb — recommended jsonb per ARCHITECTURE §6 "document-shaped data is
  jsonb", combos are exactly that; revisit if the admin UI wants relational editing.)*

**Retire the price mirror:** `pos.menu_price(name)` / `pos.oh_charge()` currently hard-code
literals used by `pos_close_table`'s server-side recompute (`43_pos_cutover.sql`,
`47_pos_payments.sql`). Replace `menu_price()` with a lookup against `pos.menu_items`
(name → price). `oh_charge()` and the `pricing_mode='open_house'` branch stay for reopened
legacy bills but are never exercised by new à-la-carte bills. This also retires the tracked
"CI price-diff check" idea (single source of truth removes the mirror).

**Seed:** the August-2026 menu goes into `49_pos_menu.sql` (or a `45_pos_seeds.sql` sibling)
as the initial rows, including the POS-only drinks category and the two add-on items.

### Client (menu-as-data)

- `menu.ts` stops being the source of truth; the menu is **fetched** from `pos.menu_*` into
  the module (cached in localStorage like `usePosData`, so the floor still paints offline).
  `buildItems()`, `reconcileItems()`, `NAME_AR`, `COMBO_DEFS` derive from fetched data. Wire
  format of `PosLine`/order items is unchanged (frozen), so closed-bill history keeps parsing.
- **Admin UI:** a menu-editor surface (owner/manager, `pos.menu`) — CRUD categories + items +
  prices + active toggles + meal composition. Mobile-first, HE/AR. Reachable from the POS
  report/manage area (exact placement decided at build).

### #1 Open-house retirement (client)

- `types.ts`: `useOH` / `oh` stay on the wire types (history) but new tables set `useOH:false`
  always; drop the floor toggle and the `SEA`/`SUN` open-house badge distinction.
- `logic.ts` `tableTotals`: always `grand = menuAll`; delete the OH cover computation for new
  bills. `buildBillPayload` sends `pricing_mode:'a_la_carte'`, `oh_charge:0`.
- Remove `OH` prices and the `oh:` category flag from the client menu model.

### #5 Per-unit kitchen done (schema + client)

- `pos.pos_mark_item(p_id, p_item_id, p_ready)` → `pos.pos_mark_item(p_id, p_item_id,
  p_delta int)` (or keep bool + add a `p_one bool`): mark **one** unit — `done = least(sent,
  done+1)` on ready, `done = greatest(served, done-1)` on undo. Read-modify-write server-side
  stays (no clobber). Baseline regen + `rls_matrix` assertions for the new arity.
- `ChefView`: the `×N` line shows a per-unit "מוכן ✓" that decrements the cooking count by one
  each tap; undo adds one back. `markDone` in `usePosData` passes the delta.

### #3 Kitchen filters (client only)

- `ChefView` gains a filter control: a searchable list of dishes (built from the fetched menu,
  standalone dishes **and** meal-component dishes), multi-select, persisted per screen in
  localStorage (separate key from the pos cache). When any filter is active, a ticket/dish is
  shown iff its name **or** any of its `components` names is in the active set.

### #4 Realtime reliability (schema + client) — the "most important" one

Root causes found:
1. **The channel subscribes once and never recovers** (the real cause of the stuck kitchen).
   On flaky venue Wi-Fi, or when a phone/tablet **locks/backgrounds**, the WebSocket dies; on
   resume nothing re-subscribes (only `window 'online'` reloads data, it does not rejoin the
   channel), and there is **no polling fallback** — so a passive kitchen screen (chef only taps
   done) shows stale orders indefinitely. `pos.pos_tables` (which carries the kitchen counts)
   *is* in `supabase_realtime` with an authenticated SELECT policy, so the path is sound when
   the channel is alive — it just never heals.
   → in `usePosData`: rejoin on `CHANNEL_ERROR` / `CLOSED` / `TIMED_OUT`; re-subscribe **and**
   resync on `visibilitychange` (page becomes visible) as well as `online`; add a slow
   **poll fallback** (e.g. every N s) as a safety net, cheap because `reload` is one round-trip.
2. **Correction (found at build, 2026-07-28):** the client also subscribes to
   `pos.pos_payments` postgres_changes, but that table is **RLS-locked — no SELECT policy,
   grants revoked, RPC-only** (`47_pos_payments.sql`). Realtime postgres_changes runs under
   the subscriber's RLS, so that subscription **never fires** — it's dead code. Adding it to
   the publication would NOT fix it without punching a SELECT policy through the table, which
   would contradict its deliberate RPC-only posture. → **remove the dead subscription**; the
   new poll fallback is the correct (and only RLS-safe) way to keep open-bill payments fresh
   across devices. **PR 1 therefore needs no realtime schema change** — its only schema touch
   is `pos_mark_item` (#5).

### #6 Floor grid (client only)

`styles.tablesGrid` is a hard `1fr 1fr` with variable-height cards (partial-paid line +
kitchen badges appear on some cards only) → ragged rows. Fix: responsive
`repeat(auto-fill, minmax(…))` columns + normalize the card so every card is equal height
regardless of which optional rows it has (reserve/space the partial-paid + kitchen-badge slots
so cards align). UI/CSS only.

## Alignment verdict

- **Roadmap:** in-scope — completes *POS ops v2* PR D and hardens the live POS; no phase jump.
  Feeds Phase 4 (QR menu) and Phase 5 (inventory ↔ menu). Roadmap line updated to point here.
- **Architecture invariants (§7) walked:**
  1. RLS on every new `pos.menu_*` table; `pos.menu` write gate in the DB, UI mirror second. ✓
  2. Anon/publishable keys only; no service-role added. ✓
  3. No PII/secrets in the repo — the menu is public-safe business data. ✓
  4. Business invariants in Postgres — price recompute reads `menu_items` (server truth), not
     a client value; per-unit done is a server read-modify-write. ✓
  5. HE + AR on every new item/category/admin-UI string; RTL correct. ✓
  6. Menu tables get a visibility posture (printed vs `pos_only`); a future public/QR read is a
     deliberate opt-in, designed-for not enabled. ✓
  7. Live-tool continuity — history preserved; `pos.html` already retired to the redirect. ✓
  8. ROADMAP is the tracker — updated this session. ✓
  - **Money on the spine, no silo:** finance posting/day-lifecycle math untouched; open-house
    retirement changes only *new-bill* pricing, never posted history. ✓
- **Vision:** serves *Operate*; makes the menu owner-editable from the app (flexibility
  principle). No drift.
- **Conflicts:** none. The only invariant-sensitive area — open-house — is handled by
  *retire-forward, preserve-history*, which keeps §7.4/§7.7 intact rather than violating them.

## Suggested build order (still one initiative)

Two PRs, each running the full pre-commit gate + its own close-out:

- **PR 1 — kitchen & floor (no menu dependency):** #4 realtime reliability + #5 per-unit done
  + #6 floor grid. Fast, high-value, low-risk; ships the "kitchen actually works" fix first.
  Schema touch = `pos_mark_item` arity + `pos_payments` publication add (baseline regen +
  `rls_matrix`).
- **PR 2 — menu-as-data (the big one):** #2 menu tables + admin UI + seed, #1 open-house
  retirement, add-on items, first-class meals, and #3 kitchen filters (depends on the menu
  data for the pickable dish list). Retires `pos.menu_price()` mirror.
  **Gated on the owner's finalized August menu** (owner will send the final version before
  this PR starts, 2026-07-28) — until then O2–O4 stay open and PR 2 does not begin.

## Revised model — owner feedback during PR 2a testing (2026-07-29)

Testing PR 2a, the owner reshaped the menu model. **Supersedes** the "separate add-on
items" decision and the flat-meal composition. Split: **PR 2a** = the stable foundation
(menu DB-sourced, open house retired, base kitchen filter, first-cut meals) — commit as-is,
minus the standalone add-ons (removed so a rejected pattern isn't committed). **PR 2b** = the
options engine + refinements below.

- **Per-item options engine (replaces standalone add-ons).** An item (or meal) carries
  **option groups**, each of one kind:
  - *choose-one* — e.g. breakfast spread לבנה|טחינה (free), or main שקשוקה|חביתה;
  - *count* — a stepper with `min`/`max`, **`included` free count**, and a **per-unit price**
    beyond that (e.g. hummus pita: 1 included, each extra +₪5; breakfast pita 0–1 free);
  - *optional-add* — e.g. egg +₪5 on חומוס/תרד, olives +₪5 on פיצה.
  The standalone `addon_egg`/`addon_olives` items go away; egg/olives become options on the
  items that offer them. Meals use the **same** option-group mechanism (no separate combo path).
- **Money validation must cover option deltas.** A line's `unit_price` = base +
  Σ(selected option deltas). `pos.menu_price` alone no longer suffices — the server close-path
  must recompute the option deltas from the DB (option prices + counts) so table-closes stay
  guarded. Design this with the options schema (a `pos.menu_option_groups` / `pos.menu_options`
  pair, or option groups as `jsonb` on the item — decide at 2b kickoff; jsonb matches the combo
  precedent but relational is cleaner for the admin UI + server price recompute).
- **Reworked meals (data):**
  - *ארוחת בוקר של הדוקטור* — choose main (שקשוקה|חביתה), choose salad (1 of 4), choose spread
    (לבנה|טחינה), pita count 0–1 (free). No fixed labneh+tahini.
  - *ארוחת חומוס* — includes hummus + salad + tahini/pickles; **optional egg +₪5**; pita count
    (1 included, extra +₪5).
  - (ארוחת השף / הדייג keep their salad/pastry choices; add option groups if the owner wants.)
- **Kitchen filter presets (replaces single multi-select).** Save several **named** filter
  sets (device-local) and switch between them quickly; each preset is a set of dish names.
- **Closed tables on the floor tab.** Surface today's closed/paid tables on the floor screen
  directly (today they're only in the report) — quick view/reopen without opening the report.
- **Admin UI (PR 2b)** manages items + their option groups + meals, in the POS-embedded editor
  (owner-confirmed placement).

## Open questions

- **O1 — meal composition storage:** jsonb on the meal row (recommended, matches ARCHITECTURE
  §6) vs relational component/slot/option tables (nicer for a relational admin UI). Decide at
  PR 2 build.
- **O2 — olives add-on price** (`תוספת זיתים`): not on the printed menu — need the number.
- **O3 — final POS-only drinks list + prices:** carry the existing four hot drinks
  (אספרסו/שחור 5, קפה עם חלב 8, תה בכוס 8, קנקן תה 15) as-is, or an updated set? Confirm.
- **O4 — pastry-of-choice set** for ארוחת השף: default = the 3 taboon pastries; confirm.
- **O5 — admin UI placement:** a new tab in the POS report/manage area vs a `pos.menu` route.

## Gate & close-out

Every PR runs the full pre-commit gate (`/simplify` → `/code-review high` →
`/security-review` → `/verify` incl. `rls_matrix.sql` extended for the new menu tables + the
`pos_mark_item` arity, to a green `RLS MATRIX: ALL ASSERTIONS PASSED`) and its own close-out
appended here. This file is updated as each PR lands.

### PR 1 close-out — kitchen & floor (2026-07-28)

Shipped items #4 (realtime reliability), #5 (per-unit kitchen "done"), #6 (floor grid).

- **#5 per-unit done** — `supabase/schema/49_pos_kitchen.sql` redefines `pos.pos_mark_item`
  to move `done` one unit per tap, clamped to `[served, sent]` (signature unchanged, so no
  client arity churn). `usePosData.markDone` mirrors the ±1 optimistically and registers a
  **pending-mark** so a reload landing before the RPC commits can't revert the tap (which
  would prompt a re-tap and double-count).
- **#4 realtime reliability** — `usePosData` now rejoins the channel on
  `CHANNEL_ERROR`/`CLOSED`/`TIMED_OUT`, resyncs on `visibilitychange` + `online`, and polls
  every 20s (visible only) as a floor. A **channel-generation token** stops our own
  `removeChannel`'s `CLOSED` from looping an endless rejoin (bug caught in code-review). The
  dead `pos_payments` `postgres_changes` subscription was removed — that table is RLS-locked
  (RPC-only), so the subscription never fired; payments now refresh via the poll/reload.
- **#6 floor grid** — `styles.tablesGrid` responsive `auto-fill minmax(140px,1fr)` (keeps
  2-up on a 320px phone, scales up on tablets) + equal-height cards. Card head is now
  name-only so the table name shows **in full** (wraps, no ellipsis); kitchen 🔔/🍳 badges
  moved to the meta line (owner-directed during verify).
- **Tests/CI** — `rls_matrix.sql` gained per-unit mark assertions (advance-by-one, clamp at
  sent and at served, viewer denied); baseline regenerated.
- **Gate** — `/simplify` (1 cleanup), `/code-review high` (2 real bugs fixed: the resubscribe
  loop and the per-unit double-count race), `/security-review` (clean), `rls_matrix` green,
  typecheck/build/dev-boot clean, owner-tested on localhost (per-unit taps + full-name grid).
- **Left for PR 2:** #1 open-house retirement, #2 menu-as-data + admin UI, #3 kitchen
  filters — gated on the owner's finalized August menu (O2 olives price, O3 drinks list).
- **Alignment:** no drift — client-only reliability + a per-unit RPC + CSS; no finance/history
  touched. Consistent with ARCHITECTURE §7 and the initiative's alignment verdict above.

## Known trade-off — editing the menu while a table is open (raised in PR 2b gate)

`pos.assert_line_prices` (server, `53_pos_close_options.sql`) validates each line's
`unit_price` against the **live** menu (`menu_price(name)` + `option_charge(id,qty)`). The
menu is now owner-editable *during service* (admin UI). Consequence: if the owner **reprices
/ renames an item or deletes an option while a table holding it is open**, that line's
snapshotted price no longer matches the recomputed one and the close is **rejected** with a
clear Hebrew message (or "תוספת לא מוכרת" if an option id was deleted). It is a hard,
visible failure — never silent money corruption — and recoverable (re-add the line at the
new price, or void it). We deliberately keep strict server validation (the "nothing from the
side" guard) rather than trusting the client's `unit_price`. **Guidance to owner:** avoid
repricing/deleting items or options mid-shift; prefer the **פעיל/active toggle** to hide an
item (hiding doesn't affect open tables or the close path). Future option if this bites:
validate against a snapshot / version the menu so already-open lines settle at their
add-time price.
