# Quotes Module — Migration Plan

Bring the quotes & contracts manager (today a separate local app at `~/lev-yam-quotes`:
Python API `serve.py` + React dashboard + `quotes-tracker.json`) into the platform as the
`quotes` module at `/app/quotes`. Slot: **the first migration** (Phase 1 in
[ROADMAP.md](../ROADMAP.md)), ahead of POS — this migration *establishes* the documented
module template that POS and every later module will follow.

**Why migrate:** one login + RBAC instead of an unprotected localhost server; data in
Postgres with RLS instead of a JSON file with no backup; quotes usable from any device
(phone!) instead of one Mac; confirmed events ready to feed the Phase 2 shared calendar.

**Why first:** it's the smallest complete tool with every module ingredient (schema, RLS,
permissions, UI, documents, real data import), and it's used by one person — the cheapest
place to learn, unlike the POS which is live on real service days.

**Live data at stake (as of 2026-07-08):** 9 quotes (3 approved, 2 paid, 2 declined,
2 expired), 3 contracts (2 **signed** — legal documents), `nextQuoteNumber` = 17.

---

## 1. What moves where

| Today (`~/lev-yam-quotes`) | Becomes |
|---|---|
| `serve.py` JSON API + file writes | Postgres tables + RLS + RPCs + triggers (`supabase/schema/30_quotes.sql`) |
| `dashboard.html` (React via CDN + Babel) | `app-src/src/modules/quotes/` (real React + TS) |
| `Lev Yam Price Quote.html` template + per-quote saved HTML | Quote page rendered **from DB data**; print CSS kept for A4 PDF export |
| `contract-template.html` + per-contract saved HTML | Contract page rendered from DB; editable clauses/fields stored in DB |
| `quotes-tracker.json` (source of truth) | `quotes.quotes` + `quotes.contracts` tables (one-time import) |
| Quote content in `DEFAULT_DATA` + localStorage (items, agenda, included, terms) | `content` jsonb on the quote row — **content finally joins the source of truth** |
| `owner-signature.txt` (legal signature) | Private storage (settings row readable only with `quotes.settings`) — **never in git** |
| `config.json` (`defaultPrepChecklist`) | `quotes.settings` row |

## 2. Data model — `30_quotes.sql`, schema `quotes`

**`quotes.quotes`** — one row per quote:
- identity: `id` uuid PK, `quote_number` text **unique** (`LY-YYMMDD-NNN`; global sequence
  seeded at 17 by the import)
- customer: `customer_name` (required), `contact_person`, `phone`, `email`
- event: `event_type`, `event_date` date, `guests`, `hours`
- lifecycle: `status` (`draft|sent|approved|declined|expired|paid`), `issue_date`,
  `sent_date`, `paid_date`, `archived` bool, `event_confirmed` bool, `notes`
- money: `subtotal`, `discount_pct`, `final_price`, `vat_rate`, `deposit_pct`
- document content: `content` jsonb (greeting, line items, included list, agenda,
  cancellation policy, terms) — jsonb, not child tables: it's document-shaped data, never
  queried across quotes (revisit only if that changes)
- `prep_checklist` jsonb (`[{text, done}]`), `created_at` / `updated_at`

**`quotes.contracts`** — at most one per quote (the app's load-bearing invariant, now
DB-enforced):
- `id` uuid PK, `contract_number` text unique (`'C-' || quote_number`),
  `quote_id` uuid **unique** FK → quotes (on delete cascade — today's delete cascade, kept)
- `status` (`draft|sent|signed`), `generated_date`, `sent_date`, `signed_date`
- signing audit (from `/api/contracts/sign`): `signed_name`, `signed_at`, `signer_ip`,
  `signer_user_agent`
- `content` jsonb: details fields + clauses **snapshotted at generation time** (a contract
  must not change retroactively when the master clauses are edited)
- `document_path`: pointer to an immutable PDF/HTML snapshot in a **private** Supabase
  Storage bucket — required for signed contracts (legal artifact), written at sign time

**`quotes.settings`** — single row: `default_prep_checklist` jsonb, `owner_signature` text
(data-URL), default quote content (items/included/agenda/terms), contract clause + details
templates (today edited via the dashboard ⚙ menu — stays editable, now stored in DB).

## 3. Behavior parity — enforced in the DB, not the UI

| serve.py behavior | Platform mechanism |
|---|---|
| One-way `sentDate` / `paidDate` stamps | trigger on status change (stamp once, never clear) |
| Auto-expire `sent` quotes after 7 days | `quotes.auto_expire()` RPC called on module load (same lazy sweep as today); pg_cron later if wanted |
| Contract `signed` ⇒ immutable; regeneration refused (409) | trigger blocks UPDATE/DELETE of signed rows; `generate_contract()` RPC checks first |
| Signing auto-confirms the event + seeds checklist | trigger on contracts.status → `signed`: quote → `approved`, `event_confirmed = true`, seed `prep_checklist` from settings |
| Quote numbering, contract 1:1 uniqueness | sequence + unique constraints (no more read-modify-write races) |
| `POST /save` raw-HTML writes | gone — documents render from data; print for PDF |

## 4. Permissions (role → module → action)

Module row `quotes` in `core.modules`; keys in `core.permissions` + `lib/permissions.ts`:
- `quotes.view` — see the dashboard, quotes, calendar
- `quotes.manage` — create/edit quotes, statuses, notes, checklists
- `quotes.contracts` — generate contracts, mark sent/signed
- `quotes.settings` — owner signature, default checklist, clause templates

Grants v1: **owner + manager only** (like finance — quotes are money + legal data; staff and
viewer get nothing). The signature is readable only via `quotes.settings`.

## 5. UI — `app-src/src/modules/quotes/`

Port the dashboard's segments and features 1:1 first, redesign later:
- **QuotesModule** — tabs/views: list with segments (פעיל / לקוחות מרוצים / ארכיון / הכל),
  inline status change, notes, revenue rollup, today's-date chip
- **Calendar view** — month grid, confirmed-event ✓ chips, "מאושרים בלבד" filter,
  prep-checklist modal (progress bar, add/remove/toggle)
- **QuotePage** (`/app/quotes/:quoteNumber`) — the quote document, editable, rendered from
  DB; keep the existing print CSS → Cmd-P → one-page A4 PDF
- **ContractPage** — rendered from DB content snapshot; print for the PDF round-trip flow;
  the lessor box shows the stored owner signature
- **Settings modal (⚙)** — signature pad, default prep checklist (reorder), clause/fields
  editing — parity with today's config menu
- Mechanics: JSX-in-Babel → TSX; every `fetch('/api/…')` → `supabase.schema('quotes')`
  query or RPC; module chrome uses the platform i18n layer (document content itself is
  Hebrew business/legal text and stays as data)

**Deliberately out of v1 (parity first):** online customer signing (`ONLINE_SIGN` is off
today too — needs public token links + an edge function; design later), alerts/reminders
(their roadmap item 6 → platform notifications, Phase 4+), "happy customers" automations.

## 6. One-time data import — ✅ done 2026-07-09

How it actually ran (script in a local scratchpad, run via the Supabase management
API — nothing with customer data ever entered this repo):

1. ✅ **Source backed up** to the private repo `OrCoAI/lev-yam-quotes` (final state
   incl. quotes 017–019, then marked ARCHIVED in its CLAUDE.md).
2. ✅ Tracker JSON → **12 quotes + 3 contracts** inserted, preserving numbers, dates,
   statuses, archived/confirmed flags and prep checklists; 3 test rows from module dev
   were purged first. Sequence already at #20 — untouched.
3. ✅ Quote `content` went in for **all 12 quotes** (better than planned): every saved
   quote HTML embeds its persisted `DEFAULT_DATA`, so line items, included list, agenda,
   pricing, terms and tweaks were parsed and imported verbatim. Contracts likewise carry
   embedded `CONTRACT_DATA`/`CLAUSES`/`DETAILS_FIELDS` → full `content` snapshots.
4. ✅ **Signed contracts:** both exported to PDF (headless Chrome) and uploaded together
   with all 3 contract HTML originals to the **private `quotes-docs` bucket**;
   `document_path` set on each contract (PDF for the signed pair, HTML for the sent one).
5. ✅ `~/lev-yam-quotes` is a read-only archive — nothing new is created there.

Parity checked in SQL: statuses, one-way sent/paid stamps, checklist counts, and the
paid-revenue rollup (₪3,540) all match the old dashboard.

## 7. Build order & cut-over

Prerequisites: none — this is the first migration. The platform i18n layer (Phase 1's
opening task) lands first or alongside, and this migration produces the documented module
template as a deliverable for POS and everything after.

1. `30_quotes.sql` — schema, RLS, triggers, RPCs, permission seeds (≈1 session)
2. Module scaffold + dashboard list/calendar port (≈1–2 sessions)
3. QuotePage + ContractPage rendering/printing from DB (≈1–2 sessions)
4. ✅ Import + parity check (see §6; revenue rollup matches the old dashboard)
5. ✅ Cut over: new quotes only in `/app/quotes`; local app archived (2026-07-09)
6. **Write the module template doc** from what this migration taught us — the checklist the
   POS migration follows next ← **only remaining item**

**Parity bar before cut-over:** a real quote taken through its full life in the module, and
a printed A4 PDF that looks identical to today's output.

## 8. After migration (hooks already in the roadmap)

- **Phase 2:** `event_confirmed` quotes surface in the shared bookings/events calendar —
  one calendar for the whole venue, prep checklists included.
- **Phase 4:** online booking + notifications open the door to online customer signing and
  stale-quote / upcoming-event alerts.
- **Phase 5:** quote revenue joins the consolidated P&L dashboards.
