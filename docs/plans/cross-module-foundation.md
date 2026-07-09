# Cross-Module Foundation — the Event, Money & Preparation Spines

**Status: design approved as the platform foundation (2026-07-09). Implement the schemas
before the POS module port so POS integrates on day one instead of being retrofitted.**

Companion to [ARCHITECTURE.md](../ARCHITECTURE.md) §6 ("shared spines, not silos") — this
file is where those spines get defined precisely enough to build.

## 1. The problem this solves

Every module today is an island. The same real-world thing — *"a confirmed event happens,
money moves, the team prepares"* — is currently scattered with **no links between the
pieces**:

| Real-world fact | Where it lives today | Connected to anything? |
|---|---|---|
| An event is confirmed | `quotes.quotes.event_confirmed` + `event_date` | No — invisible outside the quotes module |
| Deposit/balance owed for it | implied by `quotes.deposit_pct` / `final_price` | No — nothing tracks *expected* money |
| The customer paid | `quotes.paid_date` (a date, not an amount) | No — finance never hears about it |
| A day of service earned money | `public.pos_bills` (per bill) | No — finance never hears about it |
| Kitchen spent money that day | `public.pos_expenses` (food/labor) | No — duplicated conceptually by `finance.entries` expenses |
| The business ledger | `finance.entries` (manual typing) | No provenance — a human re-types what other modules already know |
| Preparation for the event | `quotes.prep_checklist` jsonb | Trapped inside one quote row |
| The calendar | doesn't exist yet (Phase 2) | — |

The end state we want: **when an event happens, every calendar shows it; money moves
between modules automatically, with provenance and logic; preparation state is visible
wherever the event is visible.** Six missing concepts get us there.

---

## 2. Concept — the Event Spine (`events` schema)

**One canonical calendar; modules project into it, they don't replace their own records.**

The Phase 2 "bookings & events" tables are not just a bookings feature — they are the
**shared spine** every module feeds. Pull the spine's design forward so quotes and POS can
attach to it now.

### `events.events` — the canonical row

```
events.events
  id               uuid PK
  title            text                     -- what shows on calendars
  event_date       date not null
  starts_at / ends_at   time (nullable)     -- '09:00–16:00' style events
  status           text: tentative | confirmed | in_progress | done | cancelled | settled
  visibility       text: public | internal  -- 'public' default (vision: public by default)
  event_type       text                     -- free taxonomy, never an enum ("no hardcoded dreams")
  capacity         int (nullable)
  source_module    text (nullable)          -- 'quotes' | 'bookings' | 'initiatives' | null = created directly
  source_id        uuid (nullable)          -- the owning row in that module's schema
  UNIQUE (source_module, source_id)         -- one projection per source fact (idempotency)
  owner_id         uuid → auth.users        -- who runs it (initiative lead later)
  notes            text
```

**Rules that make it a spine, not a copy:**

1. **The source module stays the owner of its domain truth.** A quote's contract, prices,
   and PII stay in `quotes.*`. The event row carries only what a calendar needs: title,
   date, time, status, type. Money is **never** on the event row (see §6 permissions).
2. **Projection is a DB trigger, never client code.** When `quotes.confirm_event_on_sign()`
   fires, the same trigger upserts the event row (`ON CONFLICT (source_module, source_id)`).
   A buggy or malicious client cannot produce a split-brain calendar, and quotes-module UI
   code doesn't even know the events schema exists.
3. **Projections are idempotent and re-runnable.** Every source module ships a
   `*_backfill_events()` function so existing data (the 3 confirmed quote events already
   imported) projects in, and re-running never duplicates. Same pattern every future
   module copies.
4. **Cancellation flows through.** Quote archived / booking cancelled → its projected
   event goes `cancelled` (trigger), never deleted — the calendar keeps history.
5. **Conflict awareness, not conflict prevention.** A `events.conflicts(date)` view flags
   overlapping *confirmed* events (venue is one space) so humans decide; the DB never
   blocks a double-booking outright — real life has exceptions.

### Who projects what

| Module | Projects when | Status mapping |
|---|---|---|
| quotes | contract signed / `event_confirmed` flips | `confirmed`; quote sent with event_date → optional `tentative` |
| bookings (Ph.2) | reservation / venue event created | native — bookings creates events directly |
| initiatives (Ph.3) | initiative schedules an event | native rows with `source_module='initiatives'` |
| pos | doesn't create events — **attaches** to them (see §5, business day) | — |

The public "What's happening" feed (Phase 2) is just `select … from events.events where
visibility='public' and status in ('confirmed','in_progress')` under an anon RLS policy —
the spine *is* the feed.

---

## 3. Concept — the Money Spine (finance becomes a journal with provenance)

**Every shekel that moves gets one row in finance, and that row knows where it came from.**
Finance stops being a notebook someone types into and becomes the meeting point of all
modules' money — while staying the same table the Finance module already renders.

### 3a. Provenance on `finance.entries`

Add to the existing table (backwards-compatible — existing manual rows keep working):

```
finance.entries +
  source_module   text (nullable)     -- null = manual entry (today's behavior)
  source_ref      text (nullable)     -- e.g. quote id, 'pos:2026-07-11', expense id
  event_id        uuid (nullable) → events.events   -- attribution (see 3d)
  UNIQUE (source_module, source_ref, kind, category) WHERE source_module IS NOT NULL
```

- **Manual vs derived is explicit.** `source_module IS NULL` = a human typed it (rent,
  donation). `source_module IS NOT NULL` = a module posted it. The UI shows the badge.
- **Idempotency by uniqueness.** A module posting the same source fact twice hits the
  unique index — postings are naturally re-runnable, like every schema file in this repo.
- **Derived rows are immutable from the UI; corrections are reversals.** Same philosophy
  as signed contracts: you don't edit a posted fact, you post a counter-entry. A trigger
  blocks direct UPDATE/DELETE on rows with `source_module` set (the source module's
  posting function, SECURITY DEFINER, is the one writer).

### 3b. Posting rules — when a domain fact becomes a financial fact

The core design question for each module is its **posting rule**: the moment and the
granularity at which its truth enters the journal.

| Module | Trigger moment | Posts | Granularity |
|---|---|---|---|
| quotes | deposit received (new explicit action, see 3c) | income `events` | per payment |
| quotes | quote → `paid` (balance settled) | income `events` | per payment |
| pos | **business-day close** (see §5) | income by payment method; expenses food/labor | per day summary |
| initiatives (Ph.3) | expense approved in an initiative | expense, tagged to initiative | per expense |
| inventory (Ph.5) | purchase received | expense `suppliers`/`inventory` | per purchase |

Two deliberate choices:

- **POS posts a day summary, not 80 bill rows.** `pos_bills` stays the analytical truth
  (per-bill, per-item); finance gets one legible line per day per payment method. Drill-in
  goes to the POS module, not the ledger. Tips are **not income** — they pass through to
  staff and never post.
- **Kill the double-count now, by category ownership.** Once quotes posts income
  automatically, the manual `events` income category must become *derived-only* (UI stops
  offering it for manual entry), or the owner types the same event income twice. Same for
  POS-day income when POS starts posting. **Rule: every finance category has exactly one
  writer — a module or a human, never both.**

### 3c. Expected money — the receivables layer

"Great understanding of logic" means the platform knows what *should* happen before it
does. That's a table the platform doesn't have yet:

```
finance.expected
  id            uuid PK
  direction     text: in | out
  amount        numeric(12,2)
  due_date      date
  reason        text                       -- 'deposit' | 'balance' | 'supplier' | free
  event_id      uuid (nullable) → events.events
  source_module / source_ref               -- same provenance pattern, same unique index
  status        text: open | fulfilled | cancelled
  fulfilled_by  uuid (nullable) → finance.entries(id)   -- the actual money that answered it
```

- **Signing a contract creates the money plan**: the same trigger that confirms the event
  writes two expectations — deposit (`final_price × deposit_pct`, due ~signing) and
  balance (due `event_date`). Cancelling the event cancels open expectations.
- **Recording actual money fulfills the expectation** and posts the `finance.entries` row
  in one RPC (`finance.record_payment(expected_id, amount, method, date)`), keeping plan
  and actual linked.
- This is what powers the dashboards that matter: *"outstanding deposits", "this month's
  expected income", "event X: quoted 8,400 / received 4,200 / balance due Friday"* — and
  it's the exact structure initiative budgets (Phase 3) will reuse (a budget line is an
  expectation).

### 3d. Attribution — the dimension that makes per-event P&L possible

`event_id` on both `finance.entries` and `finance.expected` (and later `initiative_id`,
added in Phase 3 by the same pattern) is the **attribution dimension**: optional, never
required, but when present it lets one view answer *"what did this event actually make?"*
— quote income + POS extras that day − food/labor/supplier costs tagged to it. A
`finance.event_pnl(event_id)` view ships with the spine. This is Phase 3's per-initiative
budget requirement landing early as two nullable columns instead of a redesign.

---

## 4. Concept — the Preparation Spine (`events.tasks`)

**Preparation attaches to the event, not to the module that sold it.**

Today `quotes.prep_checklist` is jsonb inside one quote row — invisible to the calendar,
unassignable, unaggregatable. The spine version:

```
events.tasks
  id          uuid PK
  event_id    uuid not null → events.events (cascade)
  text        text not null
  done        boolean default false
  done_by / done_at                        -- who prepared what (audit, like signing)
  assignee    uuid (nullable) → auth.users
  due_date    date (nullable)              -- defaults to event_date
  expected_id uuid (nullable) → finance.expected   -- "buy fish" ⇒ expected expense (optional)
  sort        int
```

- **Templates stay owner-editable data** (`quotes.settings.default_prep_checklist`
  already does this): confirming an event seeds tasks from the template for its
  event_type — same behavior as today, one level up.
- **Readiness is a rollup the calendar shows**: `events.readiness` view → *"Friday's
  event: 4/7 prep done"* on the launcher's Happening feed, no module-hopping.
- **A task can carry a price tag** via `expected_id` — this is the money↔preparation
  handshake the goal asks for: preparing for an event and paying for that preparation are
  one linked motion, not two apps.
- **Migration path:** quotes keeps writing `prep_checklist` jsonb until the events spine
  lands; the projection backfill converts existing checklists to task rows; then the
  quotes UI reads/writes `events.tasks` and the jsonb column is retired. (Evolution, not
  revolution — same cut-over discipline as everything else.)

---

## 5. Concept — the Business Day (time alignment & settlement)

Modules currently disagree about time: POS thinks in `business_date`, finance in
`entry_date`, quotes in `event_date`. The missing concept is the **business day** as the
settlement boundary:

- **Day close is an explicit act** (already exists socially — the POS day report). The POS
  module port adds `pos.close_day(date)`: posts the day's income summary + food/labor
  expenses into finance (per §3b), idempotent, re-runnable when a late bill is voided
  (repost = reversal + new posting).
- **Reconciliation happens at this boundary**: the day report the manager already reads
  becomes the same numbers finance holds — one source, not two spreadsheets that drift.
- **POS attaches to events instead of creating them**: bills carry an optional
  `event_id`, so a private event's bar extras land in that event's P&L, while a normal
  Friday just settles into the day.

---

## 6. Concept — how modules talk (the database is the bus)

There is no server of ours, so **cross-module integration lives in Postgres or it doesn't
exist**. The rules, made explicit:

1. **A module's client code never writes another module's tables.** Cross-module effects
   happen in triggers and SECURITY DEFINER functions that live in schema files, are
   reviewed like the contract-signing trigger, and check permissions explicitly. (The
   precedent is `quotes.confirm_event_on_sign()` — that pattern, generalized.)
2. **Cross-module reads go through contract views/RPCs, not raw tables**:
   `events.calendar(from, to)`, `events.readiness`, `finance.event_pnl(event_id)`,
   `finance.report(from, to)` (exists). A module's internal tables can then evolve
   without breaking its neighbors — the views are the API.
3. **Every projection/posting is idempotent** (unique indexes on provenance) **and ships
   a backfill function** — because every spine arrives after some data already exists,
   and this repo re-runs its schema files as the deployment mechanism.
4. **Spine schemas are horizontal, module schemas are vertical.** `core` (identity),
   `events`, and `finance` are shared infrastructure many modules write into via
   controlled functions; `quotes`, `pos`, `bookings` own their verticals. New in
   MODULE-TEMPLATE.md: a module's checklist gains two questions — *"what does this module
   project into `events`?"* and *"what does it post into `finance`, under which posting
   rule?"*

## 7. Concept — permissions on cross-cutting data

Cross-module data breaks the neat module→action model unless we say who sees what:

- **Seeing an event ≠ seeing its money.** `events.*` rows carry no amounts, so
  `events.view` can go to all staff (and `visibility='public'` rows to anon) while
  `finance.view` stays owner+manager. The `event_id` link means finance-permission
  holders can pivot money by event; nobody else can pivot events into money.
- **Derived finance rows are finance data**, full stop — a quote-posted income row is
  gated by `finance.view` even though its source is quotes. Provenance columns never leak
  PII (they hold ids, not names).
- **Tasks are operational, not financial**: `events.tasks` readable/writable at staff
  level (`events.tasks` permission), but its optional `expected_id` dereferences only
  under `finance.view` — a waiter sees "buy fish ✓", not what the fish cost.
- **Per-initiative grants (Phase 3)** layer on top exactly as ARCHITECTURE.md planned:
  membership tables + RLS on the attribution dimension (`initiative_id`), nothing here
  changes.

## 8. Canonical lifecycle vocabulary

One state language so triggers map cleanly across modules:

```
quote:     draft → sent → approved | declined | expired      (+ paid)
contract:  draft → sent → signed                              [immutable]
event:     tentative → confirmed → in_progress → done → settled   (× cancelled)
money:     expected(open) → fulfilled | cancelled ;  entry: posted → (reversed)
```

The couplings, all DB-enforced:
- contract `signed` ⇒ event `confirmed` + expectations created (deposit, balance)
- event `cancelled` ⇒ open expectations `cancelled` (money already received stays posted —
  refunds are explicit reversals, a human decision)
- event `done` + all expectations fulfilled ⇒ event `settled` — the state that means
  *"this actually finished, including the money"*, which no current status can express.

## 9. Implementation order

Sized so the spines land **before** the POS module port (the next roadmap item), because
POS is the biggest writer and retrofitting it later costs a second migration:

1. **`21_finance_spine.sql`** — provenance columns + immutability trigger on derived rows,
   `finance.expected`, `finance.record_payment()`, `event_pnl` view stub. *(smallest, no
   UI required to be useful)*
2. **`40_events.sql`** — `events` schema: `events.events`, `events.tasks`, calendar/
   readiness/conflicts views, RLS (staff view; anon → public rows), permission seeds;
   quotes projection trigger + `quotes.backfill_events()`; expectations-on-sign trigger.
3. **Finance module UI, small pass** — show provenance badges; stop offering derived-only
   categories for manual entry; "expected" tab (list + fulfill).
4. **POS module port (already next on the roadmap)** — built against the spines from day
   one: `pos.close_day()` posting rule, optional `event_id` on bills.
5. **Phase 2 bookings** — now *rides* the spine instead of creating it; the public feed
   is a view that already exists.
6. **MODULE-TEMPLATE.md** — add the two spine questions (§6.4) once 1–2 are proven.

## 10. Decisions (locked with the owner, 2026-07-09)

- **VAT — post gross.** Every entry is the full amount charged/paid; VAT is a reporting
  concern (a view can derive it from quotes' `vat_rate` later).
- **POS income granularity — day summary** per payment method at day close; per-bill and
  per-item truth stays in the POS module.
- **Deposit due date — signing + N days**, N owner-editable as
  `quotes.settings.quote_defaults ->> 'deposit_due_days'` (default 7), no deploy needed.
- **Tentative quotes on the calendar — yes**: a `sent` quote with an event date projects
  as `tentative` + `internal` (staff see the pipeline and clashes; never public — quote
  titles carry customer PII, so **all** quote-sourced events stay internal).

Implemented in `supabase/schema/21_finance_spine.sql` and `40_events.sql` (steps 1–2 of
§9); the finance UI pass and the POS port build on them next.
