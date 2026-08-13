-- =====================================================================
--  55_finance_reconciliation.sql — "are the books aligned?" (PR B of the
--  finance books-integrity initiative).
--
--  The first write of a POS day to the books is a deliberate manual act
--  (pos.close_day). If nobody presses it, the revenue simply is not in the
--  books and NOTHING says so. That already happened in production: the first
--  week of July 2026 was never posted and was found by hand during the POS
--  parity trial. This file makes that state visible instead of silent.
--
--  Four checks, all computed live (never a stored/dismissible flag — an
--  alert you can dismiss is an alert that lies):
--    1. unposted_day    — a day with real money that was never written
--    2. recompute_drift — a booked day whose recomputation differs from the
--                         books, i.e. the auto re-post (48) failed or was bypassed
--    3. overdue_expected— finance.expected still open past its due_date
--    4. pinned          — (PR C) a day the owner froze. Listed so the freeze
--                         stays visible; 'low' while it costs nothing,
--                         'medium' once money starts piling up outside it.
--
--  Each item carries the action that resolves it, so the UI never has to
--  encode "what do I do about this".
--
--  PERFORMANCE NOTE (measured, /simplify 2026-08-03): the first cut of this
--  file asked the question one day at a time — a per-day function call inside
--  a lateral, plus pos.day_is_posted() in a WHERE that the planner pushed down
--  into the union arms so it ran once per BILL rather than once per day. On 90
--  days of realistic volume that was 3,602 day_is_posted() calls and ~718ms per
--  request, on the hot path of a launcher badge. Everything below is therefore
--  SET-BASED: three grouped passes over the POS sources, one grouped pass over
--  the booked entries, joined. Same answers, ~45ms.
--
--  Re-runnable; apply after 54. Plan: docs/plans/finance-books-integrity.md
-- =====================================================================

-- ---------------------------------------------------------------------
--  1) The four legs a day WOULD post, computed without writing anything.
--
--     Lifted out of pos.post_day (47) so the two can never disagree: post_day
--     now consumes this, which keeps the leg definitions and the two-source
--     legacy revenue read authored in one place.
--
--     INTERNAL: security definer with NO permission check, revoked from every
--     client role — exactly like pos.post_day itself. It must be callable both
--     by the auto re-post trigger (which runs as whichever staff member edited
--     an expense) and by the reconciliation report (which runs for a finance
--     reader who may hold no POS permissions at all), so gating it on either
--     module's permission would break one of the two callers. The gate lives on
--     the public entry points. Deviation from the plan's standing rule
--     ("invoker, or definer WITH a has_permission check") recorded there.
--
--     Single-day shape, for post_day. The reconciliation report deliberately
--     does NOT call this per day — see the performance note above.
-- ---------------------------------------------------------------------
create or replace function pos.day_expected_legs(p_date date)
returns table (leg text, kind text, category text, amount numeric)
language plpgsql stable security definer set search_path = pos, finance, core as $$
declare
  v_cash numeric; v_card numeric; v_food numeric; v_labor numeric;
begin
  -- Revenue for the day, net of tips, from BOTH payment sources:
  --   * new bills record pos_payments rows — sum (amount − tip_part) by method,
  --     attributed to the day the payment was TAKEN (a deposit counts when taken).
  --   * LEGACY bills (closed before split-payments shipped) have NO payment rows;
  --     their money lives only on the bill. Fall back to the pre-PR-C grammar:
  --     card = least(card_paid, grand_total), cash = the rest of grand_total —
  --     which nets tips out at the grand-total level and reproduces the numbers
  --     those days were originally posted with. Without this second source,
  --     re-posting any historical day recomputes its revenue as ~0 and the
  --     auto re-post (48) wipes it from the books on the next expense edit.
  select coalesce(sum(p.amount - p.tip_part) filter (where p.method = 'cash'), 0),
         coalesce(sum(p.amount - p.tip_part) filter (where p.method = 'card'), 0)
    into v_cash, v_card
  from pos.pos_payments p
  where (p.taken_at at time zone 'Asia/Jerusalem')::date = p_date;

  select v_cash + coalesce(sum(b.grand_total - least(b.card_paid, b.grand_total)), 0),
         v_card + coalesce(sum(least(b.card_paid, b.grand_total)), 0)
    into v_cash, v_card
  from pos.pos_bills b
  where b.status = 'paid'
    and (b.paid_at at time zone 'Asia/Jerusalem')::date = p_date
    and not exists (select 1 from pos.pos_payments p where p.bill_id = b.id);

  select coalesce(sum(e.amount) filter (where e.kind = 'food'), 0),
         coalesce(sum(e.amount) filter (where e.kind = 'labor'), 0)
    into v_food, v_labor
  from pos.pos_expenses e where e.business_date = p_date;

  return query select * from (values
    ('cash',  'income',  'pos',       v_cash),
    ('card',  'income',  'pos',       v_card),
    ('food',  'expense', 'pos_food',  v_food),
    ('labor', 'expense', 'pos_labor', v_labor)
  ) as t(leg, kind, category, amount);
end; $$;

revoke all on function pos.day_expected_legs(date) from public;

-- The READER half of the source_ref grammar whose writer half is
-- pos.day_ref_prefix() (48): 'pos:<date>:<leg>[:r<n>]' — segment 3 is the leg.
-- Declared next to its counterpart's contract so the format has exactly two
-- named sites instead of a literal re-spelled at every comparison.
create or replace function pos.day_ref_leg(p_ref text)
returns text language sql immutable as $$ select split_part(p_ref, ':', 3); $$;
-- Pure string function over the caller's own argument, so a PUBLIC grant leaks
-- nothing — revoked anyway to match its writer half (day_ref_prefix, 48) and the
-- standing rule for this initiative. Every exception to that rule is one more
-- judgement call at the next review; the repo has shipped this bug twice.
revoke all on function pos.day_ref_leg(text) from public;

-- ---------------------------------------------------------------------
--  2) post_day now consumes the extracted computation instead of carrying
--     its own copy. Behaviour is unchanged — same legs, same order, same
--     source_ref grammar — which matters because pos.day_is_posted() and the
--     auto re-post both match against that grammar and would stop matching
--     history if it drifted by a single character.
--
--     Authored HERE and only here: 47_pos_payments.sql used to carry a copy,
--     which a re-run of that file would restore — silently reinstating a
--     post_day with no pinned-day refusal.
-- ---------------------------------------------------------------------
create or replace function pos.post_day(p_date date)
returns jsonb language plpgsql security definer
set search_path = pos, finance, core as $$
declare
  leg record;
  posted jsonb := '[]'::jsonb;
  amounts jsonb := '{}'::jsonb;   -- the cash/card/food/labor summary the close-day screen reads
  v_current numeric; v_n int; v_delta numeric; v_ref text; v_entry uuid;
begin
  -- A pinned day holds an owner correction (PR C). Refusing here rather than in
  -- pos.close_day() means every caller — the manual close, the reconciliation
  -- tab's fix button, anything added later — inherits the protection by
  -- default. The trigger path never reaches this: pos.repost_if_posted() (48)
  -- checks the pin first and skips silently, because it runs inside someone
  -- else's expense edit and must not abort it.
  if pos.day_is_pinned(p_date) then
    raise exception 'היום % נעול לאחר תיקון של הבעלים — יש לבטל את הנעילה לפני רישום מחדש', to_char(p_date, 'DD.MM.YYYY');
  end if;

  perform set_config('levyam.finance_posting', 'on', true);
  for leg in select * from pos.day_expected_legs(p_date)
  loop
    -- built from the legs themselves, so a fifth leg would appear automatically
    amounts := amounts || jsonb_build_object(leg.leg, leg.amount);

    v_ref := pos.day_ref_prefix(p_date) || leg.leg;
    select coalesce(sum(amount), 0), count(*) into v_current, v_n
    from finance.entries
    where source_module = 'pos'
      and (source_ref = v_ref or source_ref like v_ref || ':r%');

    v_delta := leg.amount - v_current;
    if v_delta = 0 then continue; end if;

    insert into finance.entries
      (kind, category, amount, payment_method, entry_date, note, source_module, source_ref)
    values (
      leg.kind, leg.category, v_delta,
      case leg.leg when 'cash' then 'cash' when 'card' then 'grow' else null end,
      p_date,
      case when v_n = 0 then 'סגירת יום ' || to_char(p_date, 'DD.MM')
           else 'תיקון סגירת יום ' || to_char(p_date, 'DD.MM') end,
      'pos',
      case when v_n = 0 then v_ref else v_ref || ':r' || (v_n + 1) end
    )
    returning id into v_entry;

    posted = posted || jsonb_build_object(
      'leg', leg.leg, 'amount', v_delta, 'entry_id', v_entry,
      'correction', v_n > 0);
  end loop;
  perform set_config('levyam.finance_posting', '', true);

  return jsonb_build_object('date', p_date, 'posted', posted) || amounts;
end; $$;

-- post_day is internal: no role may call it directly. The revoke lives with the
-- definition, which is this file — 47's grants block notes why it moved.
revoke all on function pos.post_day(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------
--  3) The drift items, as ROWS.
--
--     Internal (no permission check, revoked from clients) so the two public
--     entry points below can share it: reconciliation() aggregates it to
--     jsonb, reconciliation_counts() counts it without ever building a payload.
--     That is what makes the badge query genuinely cheap rather than "the full
--     report with its result thrown away".
-- ---------------------------------------------------------------------
--     `severity` is a real output column, not something the count has to dig
--     back out of the jsonb: pinned days are listed but must NOT light the
--     badge (a pin is a deliberate state, not a problem, and a badge that
--     never clears is one nobody reads). reconciliation_counts() filters on it.
--     `modules` names who OWNS each item, so the launcher can badge that tile.
-- ---------------------------------------------------------------------
-- DROP first, not just `create or replace`: this function's OUT parameters
-- have changed twice now (severity, then modules), and Postgres refuses to
-- replace a function whose result row type differs — 42P13. Without this the
-- file applies cleanly to a fresh database and FAILS on every existing one,
-- which is the only place it actually matters. Nothing depends on it in the
-- catalog (string-bodied functions record no dependency), and the two callers
-- are recreated below in the same file.
drop function if exists finance.reconciliation_items(date);

create function finance.reconciliation_items(p_since date)
returns table (sort_key text, severity text, modules text[], item jsonb)
language sql stable security definer set search_path = finance, pos, core as $$
  with
  -- sargable bounds: compare the raw timestamp against Jerusalem midnight so
  -- the existing timestamptz indexes are usable (an `(x at time zone …)::date`
  -- predicate is an expression over the column and can never be)
  bounds as (select (p_since::timestamp at time zone 'Asia/Jerusalem') as from_ts),
  pay as (
    select (p.taken_at at time zone 'Asia/Jerusalem')::date as d,
           coalesce(sum(p.amount - p.tip_part) filter (where p.method = 'cash'), 0) as cash,
           coalesce(sum(p.amount - p.tip_part) filter (where p.method = 'card'), 0) as card
    from pos.pos_payments p, bounds where p.taken_at >= bounds.from_ts group by 1
  ),
  legacy as (
    select (b.paid_at at time zone 'Asia/Jerusalem')::date as d,
           coalesce(sum(b.grand_total - least(b.card_paid, b.grand_total)), 0) as cash,
           coalesce(sum(least(b.card_paid, b.grand_total)), 0) as card
    from pos.pos_bills b, bounds
    where b.status = 'paid' and b.paid_at >= bounds.from_ts
      and not exists (select 1 from pos.pos_payments p where p.bill_id = b.id)
    group by 1
  ),
  spend as (
    select e.business_date as d,
           coalesce(sum(e.amount) filter (where e.kind = 'food'), 0) as food,
           coalesce(sum(e.amount) filter (where e.kind = 'labor'), 0) as labor
    from pos.pos_expenses e where e.business_date >= p_since group by 1
  ),
  -- what the books already hold per day and leg, in one pass (no per-day
  -- correlated subquery, no LIKE on source_ref — the day comes from entry_date)
  booked as (
    select entry_date as d, pos.day_ref_leg(source_ref) as leg, sum(amount) as amt
    from finance.entries
    where source_module = 'pos' and entry_date >= p_since
      -- ONLY day-close postings. source_module='pos' is not sufficient: a
      -- finance.expected row carrying source_module='pos' would be fulfilled by
      -- record_payment() as 'expected:<uuid>', which parses to an empty leg,
      -- adds its date to posted_days, and turns a genuinely unposted day into a
      -- bogus four-leg drift item. Unreachable today (only quotes writes
      -- expectations) — pinned here so it stays that way.
      and source_ref like pos.day_ref_prefix(entry_date) || '%'
    group by 1, 2
  ),
  all_days as (
    select d from pay union select d from legacy
    union select d from spend union select d from booked
  ),
  expected as (
    select a.d,
           coalesce(pay.cash, 0) + coalesce(legacy.cash, 0) as cash,
           coalesce(pay.card, 0) + coalesce(legacy.card, 0) as card,
           coalesce(spend.food, 0)  as food,
           coalesce(spend.labor, 0) as labor
    from all_days a
    left join pay    on pay.d = a.d
    left join legacy on legacy.d = a.d
    left join spend  on spend.d = a.d
  ),
  posted_days as (select distinct d from booked),
  -- Per-leg comparison for EVERY day in the window, booked or not. It is
  -- deliberately not restricted to booked days: check 4 needs the deltas of a
  -- day that is pinned but was never posted, where `booked` holds nothing and
  -- the delta is therefore the day's entire takings. Check 2 applies the
  -- "booked" restriction itself.
  leg_delta as (
    select e.d, l.leg,
           (case l.leg when 'cash' then e.cash when 'card' then e.card
                       when 'food' then e.food else e.labor end)
           - coalesce(b.amt, 0) as delta
    from expected e
    cross join (values ('cash'), ('card'), ('food'), ('labor')) as l(leg)
    left join booked b on b.d = e.d and b.leg = l.leg
  ),
  -- rolled up per day: read by check 2 (unpinned ⇒ drift) and by check 4
  -- (pinned ⇒ how far the owner's correction currently holds the day apart)
  day_drift as (
    select ld.d,
           jsonb_agg(jsonb_build_object('leg', ld.leg, 'delta', ld.delta))
             filter (where ld.delta <> 0) as legs,
           -- MAGNITUDE: how much money is in the wrong place, summed over the
           -- legs. Not a net and not a P&L — a signed sum would add revenue
           -- legs (cash/card) to cost legs (food/labor), which carry the same
           -- sign here but the opposite meaning, and would report a drift of
           -- +100 cash / -100 card as "0", i.e. nothing wrong. The per-leg
           -- breakdown next to it in the UI carries the direction.
           coalesce(sum(abs(ld.delta)), 0) as total
    from leg_delta ld group by ld.d
  )
  -- 1) days with real money that were never written to the books
  select 'a:' || e.d, 'high', array['pos'], jsonb_build_object(
           'type', 'unposted_day', 'severity', 'high', 'business_date', e.d,
           'cash', e.cash, 'card', e.card, 'food', e.food, 'labor', e.labor,
           'revenue', e.cash + e.card, 'fix', 'post_day')
  from expected e
  where not exists (select 1 from posted_days pd where pd.d = e.d)
    -- TODAY IS NOT LATE. Posting a day is the deliberate end-of-service act, so
    -- the day currently being served has not failed to be posted — it simply is
    -- not over. Without this bound the first paid bill of every service lit both
    -- launcher badges red and the banner, and offered a one-click "post to
    -- books" that would have written a PARTIAL day into the ledger and left the
    -- rest of the service to arrive as re-post deltas. The alarm has to mean
    -- something, or it gets ignored on the day it is real.
    and e.d < (now() at time zone 'Asia/Jerusalem')::date
    -- a day whose money all nets to zero is not "unposted", it is empty
    and (e.cash + e.card + e.food + e.labor) <> 0
    -- ...and a PINNED day is not "unposted" either, it is frozen. Reporting it
    -- here would offer a "post to books" button that pos.post_day() refuses by
    -- design: the fix could never succeed, the item could never clear, and both
    -- launcher badges would stay lit forever. Check 4 reports it instead.
    and not exists (select 1 from pos.day_pins p where p.business_date = e.d)

  union all
  -- 2) a BOOKED day that no longer matches its recomputation. Should always be
  --    empty: the auto re-post (48) writes the correcting delta on every change.
  --    A non-zero here means that trigger failed or was bypassed.
  --    PINNED days are excluded and reported by branch 4 instead: on a pinned
  --    day the books are SUPPOSED to differ from the recomputation — that is
  --    what the owner's correction did — so listing it here would offer a "post
  --    to books" button that un-does the very correction the pin protects.
  select 'b:' || d.d, 'high', array['pos'], jsonb_build_object(
           'type', 'recompute_drift', 'severity', 'high', 'business_date', d.d,
           'legs', d.legs, 'total_delta', d.total, 'fix', 'post_day')
  from day_drift d
  -- non-null iff at least one leg drifted — the direct signal. Keyed on the
  -- legs and not on the total on purpose: the legs are what "drifted" MEANS,
  -- so this check cannot be broken by a later change to how `total` is rolled
  -- up (a signed one used to report +100 cash / −100 card as "0")
  where d.legs is not null
    -- BOOKED days only — leg_delta now spans every day, so an unposted day would
    -- otherwise surface here as well as in check 1
    and exists (select 1 from posted_days pd where pd.d = d.d)
    and not exists (select 1 from pos.day_pins p where p.business_date = d.d)

  union all
  -- 3) money that should have moved and did not
  select 'c:' || to_char(x.due_date, 'YYYY-MM-DD') || ':' || x.id,
         case when x.due_date < current_date - 30 then 'high' else 'medium' end,
         -- the module that CREATED this expectation owns it: a deposit from a
         -- signed quote is the quotes module's problem to chase, even though
         -- the payment itself is recorded in finance. Guarded by core.modules
         -- so a retired or misspelled provenance can never badge a tile that
         -- does not exist; a hand-created expectation belongs to nobody but
         -- finance and yields an empty array.
         case when x.source_module is not null and x.source_module <> 'finance'
                   and exists (select 1 from core.modules m where m.key = x.source_module)
              then array[x.source_module] else '{}'::text[] end,
         jsonb_build_object(
           'type', 'overdue_expected',
           'severity', case when x.due_date < current_date - 30 then 'high' else 'medium' end,
           'expected_id', x.id, 'direction', x.direction, 'category', x.category,
           -- what is STILL OWED, not the original figure: a part-paid deposit is
           -- still overdue, but chasing it for the full amount would be wrong.
           -- `amount_total`/`amount_paid` ride along for API consumers; the
           -- ReconcileTab renders `amount` only, and DriftItem deliberately
           -- declares just the fields it uses, so they are not in the TS type.
           'amount', x.amount - x.paid_amount,
           'amount_total', x.amount, 'amount_paid', x.paid_amount,
           'due_date', x.due_date, 'reason', x.reason,
           'days_overdue', current_date - x.due_date, 'fix', 'record_payment',
           -- provenance travels with the item so the UI can link to the thing
           -- that CAUSED it (the signed quote behind an overdue deposit),
           -- rather than only to the place where it gets paid
           'source_module', x.source_module, 'source_ref', x.source_ref)
  from finance.expected x
  where x.status = 'open' and x.due_date is not null and x.due_date < current_date

  union all
  -- 4) every pinned day, always (PR C). A pin freezes the WHOLE day: POS has
  --    stopped writing it to the books entirely, so anything entered on that
  --    day afterwards — a food cost, a late payment — never lands. Listed even
  --    when nothing has accumulated yet, because the freeze itself is the live
  --    invisible state and a day pinned months ago must not quietly become
  --    permanent.
  --
  --    Severity is therefore NOT constant. 'low' while the books still match
  --    the recomputation (the pin is costing nothing, so it must not light a
  --    badge that then never clears); 'medium' the moment real money starts
  --    piling up outside the books, which is a genuine problem again. A day
  --    pinned before it was ever posted lands here too, and its delta is the
  --    day's whole takings — hence leg_delta spanning unbooked days as well.
  --
  --    Deliberately NOT bounded by p_since — same reasoning as open
  --    expectations. There are a handful of pins ever, and one made last year
  --    is exactly the one worth remembering. `legs` is therefore best-effort:
  --    non-null only for pins inside the scanned window, null outside it.
  select 'd:' || p.business_date,
         case when d.legs is null then 'low' else 'medium' end,
         array['pos'],
         jsonb_build_object(
           'type', 'pinned',
           'severity', case when d.legs is null then 'low' else 'medium' end,
           'business_date', p.business_date,
           'reason', p.reason, 'pinned_at', p.pinned_at,
           'legs', d.legs, 'total_delta', coalesce(d.total, 0), 'fix', 'unpin')
  from pos.day_pins p
  left join day_drift d on d.d = p.business_date;
$$;

revoke all on function finance.reconciliation_items(date) from public;

-- ---------------------------------------------------------------------
--  4) The two public entry points.
--
--     SECURITY DEFINER with an explicit finance.view check — a deliberate
--     departure from finance.report()/event_pnl(), which are invoker-rights.
--     Those read only finance.entries, which every finance.view holder can
--     already see. These must read pos.pos_payments / pos_bills / pos_expenses
--     to know whether a day's money exists at all, and under invoker rights a
--     finance reader without POS permissions would see zero POS rows and be
--     told the books are perfectly aligned — the single worst answer this
--     function could give. So they read with definer rights and gate explicitly
--     on the permission that should govern them.
--
--     p_since bounds the POS scan (the ledger only grows); open expectations
--     are never bounded — an overdue deposit from last year is still overdue.
-- ---------------------------------------------------------------------
create or replace function finance.reconciliation(p_since date default null)
returns jsonb language plpgsql stable security definer
set search_path = finance, pos, core as $$
declare
  v_since date := coalesce(p_since, current_date - 90);
  v_items jsonb;
  v_count int;
begin
  if not core.has_permission('finance.view') then
    raise exception 'permission denied';
  end if;
  -- `count` is the ACTIONABLE count (what the badges show), not items length:
  -- pinned days are listed but are not a problem to be fixed. The UI decides
  -- "all clear" from items being empty, never from count.
  select coalesce(jsonb_agg(item order by sort_key), '[]'::jsonb),
         count(*) filter (where severity <> 'low')
    into v_items, v_count from finance.reconciliation_items(v_since);
  -- v_count is the same number reconciliation_counts() reports under 'finance'
  return jsonb_build_object(
    'since', v_since, 'generated_at', now(),
    'count', v_count, 'items', v_items);
end; $$;

-- Genuinely count-only: shares the item query but never builds the payload.
--
-- Returns a MAP of module key → count, not a single number, so the launcher can
-- badge whichever tile owns the problem. Every item names the module
-- responsible for it (reconciliation_items.modules): an unposted day is POS's,
-- an overdue deposit from a signed quote is the quotes module's to chase. The
-- 'finance' entry is always the full actionable total — the books are finance's
-- business whoever caused the drift.
--
-- The shell must not have to know which modules exist (ARCHITECTURE.md), so the
-- DATA decides which tiles light up: a future module that posts to finance gets
-- a badge by writing its own provenance, with no shell change at all.
--
-- Counts what needs ACTION — pinned days that cost nothing (severity 'low') are
-- excluded, or the badge would sit permanently lit on a state the owner chose.
drop function if exists finance.reconciliation_count(date);

create or replace function finance.reconciliation_counts(p_since date default null)
returns jsonb language plpgsql stable security definer
set search_path = finance, pos, core as $$
declare
  v_since date := coalesce(p_since, current_date - 90);
  v_out jsonb;
begin
  if not core.has_permission('finance.view') then
    raise exception 'permission denied';
  end if;
  -- materialized: referenced twice below, and the scan must happen once
  with it as materialized (
    select modules from finance.reconciliation_items(v_since) where severity <> 'low'
  ),
  per_module as (
    select m as key, count(*) as n
    from it cross join lateral unnest(it.modules) as m
    group by m
  )
  select coalesce((select jsonb_object_agg(key, n) from per_module), '{}'::jsonb)
         || jsonb_build_object('finance', (select count(*) from it))
    into v_out;
  return v_out;
end; $$;

-- revoking from `authenticated` alone leaves the implicit PUBLIC grant in place
revoke all on function finance.reconciliation(date) from public;
revoke all on function finance.reconciliation_counts(date) from public;
grant execute on function finance.reconciliation(date) to authenticated;
grant execute on function finance.reconciliation_counts(date) to authenticated;
