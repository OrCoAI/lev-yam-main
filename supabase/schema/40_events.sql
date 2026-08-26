-- =====================================================================
--  Lev Yam platform — EVENTS SPINE (the shared calendar every module feeds)
--  Run in the Supabase SQL editor AFTER 21_finance_spine.sql.
--  Design: docs/plans/cross-module-foundation.md §2/§4 (decisions locked
--  2026-07-09: 'sent' quotes project as TENTATIVE + INTERNAL; deposits due
--  signing + N days, N owner-editable in quotes.settings.quote_defaults).
--
--  What this creates:
--    * events.events — ONE canonical calendar row per real-world event.
--      Modules PROJECT into it via DB triggers (never client code), keyed
--      UNIQUE (source_module, source_id) so projections are idempotent.
--    * events.tasks — preparation attached to the event, not to the module
--      that sold it (assignable, auditable, optionally priced via
--      finance.expected). Quotes' jsonb prep_checklist migrates here in
--      Phase 2; until then quotes keeps its own checklist.
--    * Views: events.calendar (internal, with readiness counts),
--      events.feed (public columns only — the Phase 2 "What's happening"
--      page reads this), events.conflicts (same-day confirmed overlaps).
--    * Quotes → events integration (the first projector):
--        - quote with event_date: sent → tentative/internal; confirmed →
--          confirmed/internal (titles carry customer names = PII, so
--          quote-sourced events are ALWAYS internal — never on the feed)
--        - contract signed → deposit + balance rows in finance.expected
--        - quote marked paid → open expectations fulfilled, income posted
--        - declined/expired/archived/deleted → projection cancelled/removed,
--          open expectations cancelled
--        - quotes.backfill_events() — idempotent projection of existing data
--          (expectations only for future unpaid events; history stays as the
--          manual finance entries the owner already typed — no double count).
--
--  The 'events' module row is seeded DISABLED: permission keys need it
--  (core.permissions.module FK), but there is no /app/events UI yet — Phase 2
--  flips enabled=true so the launcher tile appears. Expose the `events`
--  schema (Settings → API) only when that UI lands.
-- =====================================================================

create schema if not exists events;

-- ---------------------------------------------------------------------
--  1) events.events — the canonical event
-- ---------------------------------------------------------------------
create table if not exists events.events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  event_date    date not null,
  starts_at     time,
  ends_at       time,
  status        text not null default 'confirmed'
                check (status in ('tentative','confirmed','in_progress','done','settled','cancelled')),
  visibility    text not null default 'public'          -- vision: public by default
                check (visibility in ('public','internal')),
  event_type    text not null default '',               -- free taxonomy, never an enum
  capacity      int,
  source_module text,                                   -- null = created directly (bookings, Phase 2)
  source_id     uuid,
  owner_id      uuid references auth.users(id),
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint events_events_source_pair_check
    check ((source_module is null) = (source_id is null))
);

-- One projection per source fact — the idempotency spine (docs §2 rule 1).
create unique index if not exists events_events_source_uniq
  on events.events (source_module, source_id)
  where source_module is not null;
create index if not exists events_events_date_idx   on events.events (event_date);
create index if not exists events_events_status_idx on events.events (status);

-- ---------------------------------------------------------------------
--  2) events.tasks — preparation attached to the event
-- ---------------------------------------------------------------------
create table if not exists events.tasks (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events.events(id) on delete cascade,
  text        text not null,
  done        boolean not null default false,
  done_by     uuid references auth.users(id),
  done_at     timestamptz,
  assignee    uuid references auth.users(id),
  due_date    date,                                     -- null = by the event date
  expected_id uuid references finance.expected(id) on delete set null,  -- "buy fish" ⇒ its cost
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists events_tasks_event_idx on events.tasks (event_id);

-- ---------------------------------------------------------------------
--  3) Housekeeping triggers
-- ---------------------------------------------------------------------
create or replace function events.touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists events_events_touch on events.events;
create trigger events_events_touch
  before update on events.events
  for each row execute function events.touch();

drop trigger if exists events_tasks_touch on events.tasks;
create trigger events_tasks_touch
  before update on events.tasks
  for each row execute function events.touch();

-- Who prepared what: stamp done_by/done_at when a task flips done (audit,
-- same spirit as contract signing capture).
create or replace function events.task_done_stamp()
returns trigger language plpgsql as $$
begin
  if new.done and not old.done then
    new.done_by := coalesce(new.done_by, auth.uid());
    new.done_at := coalesce(new.done_at, now());
  elsif not new.done and old.done then
    new.done_by := null;
    new.done_at := null;
  end if;
  return new;
end; $$;

drop trigger if exists events_tasks_done_stamp on events.tasks;
create trigger events_tasks_done_stamp
  before update on events.tasks
  for each row execute function events.task_done_stamp();

-- ---------------------------------------------------------------------
--  4) Attribution FKs deferred from 21_finance_spine.sql (this table now exists)
-- ---------------------------------------------------------------------
do $$ begin
  alter table finance.entries add constraint finance_entries_event_fk
    foreign key (event_id) references events.events(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table finance.expected add constraint finance_expected_event_fk
    foreign key (event_id) references events.events(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
--  5) Contract views — cross-module reads go through these, not raw tables
--     (docs §6 rule 2). security_invoker: they inherit the caller's RLS.
-- ---------------------------------------------------------------------
create or replace view events.calendar with (security_invoker = true) as
  select e.id, e.title, e.event_date, e.starts_at, e.ends_at, e.status,
         e.visibility, e.event_type, e.capacity, e.source_module, e.source_id,
         e.owner_id, e.notes,
         coalesce(t.total, 0) as tasks_total,
         coalesce(t.done,  0) as tasks_done
  from events.events e
  left join (
    select event_id, count(*) as total, count(*) filter (where done) as done
    from events.tasks group by event_id
  ) t on t.event_id = e.id;

-- Public feed: published columns only (no notes/owner/source) — what the
-- Phase 2 "What's happening" page on levyam.com reads as anon.
create or replace view events.feed with (security_invoker = true) as
  select id, title, event_date, starts_at, ends_at, status, event_type, capacity
  from events.events
  where visibility = 'public' and status in ('confirmed','in_progress');

-- Same-day overlaps between confirmed events — flagged for humans, never
-- blocked by the DB (docs §2 rule 5). Null times = all-day = clashes with
-- anything that date.
create or replace view events.conflicts with (security_invoker = true) as
  select a.id as event_a, b.id as event_b, a.event_date
  from events.events a
  join events.events b on b.event_date = a.event_date and b.id > a.id
  where a.status in ('confirmed','in_progress')
    and b.status in ('confirmed','in_progress')
    and (a.starts_at is null or b.starts_at is null
         or (a.starts_at <= coalesce(b.ends_at, b.starts_at)
             and b.starts_at <= coalesce(a.ends_at, a.starts_at)));

-- ---------------------------------------------------------------------
--  6) Row-Level Security
--     Seeing an event ≠ seeing its money (docs §7): event rows carry no
--     amounts; finance stays behind finance.view.
-- ---------------------------------------------------------------------
alter table events.events enable row level security;
alter table events.tasks  enable row level security;

drop policy if exists "events_events_select" on events.events;
drop policy if exists "events_events_public" on events.events;
drop policy if exists "events_events_write"  on events.events;
drop policy if exists "events_tasks_select"  on events.tasks;
drop policy if exists "events_tasks_write"   on events.tasks;

-- (select ...) wrapper = one InitPlan eval per statement, not per row (MODULE-TEMPLATE.md §1)
-- staff view everything
create policy "events_events_select" on events.events for select to authenticated
  using ((select core.has_permission('events.view')));
-- anyone (incl. anon) reads published rows — the feed is public by default
create policy "events_events_public" on events.events for select to anon, authenticated
  using (visibility = 'public' and status in ('confirmed','in_progress'));
-- direct create/edit (bookings UI, Phase 2); module projections are
-- SECURITY DEFINER triggers and bypass this
create policy "events_events_write" on events.events for all to authenticated
  using ((select core.has_permission('events.manage')))
  with check ((select core.has_permission('events.manage')));

create policy "events_tasks_select" on events.tasks for select to authenticated
  using ((select core.has_permission('events.view')));
create policy "events_tasks_write" on events.tasks for all to authenticated
  using ((select core.has_permission('events.tasks')))
  with check ((select core.has_permission('events.tasks')));

-- ---------------------------------------------------------------------
--  Grants (RLS still gates every statement). Anon gets COLUMN-level select
--  only on published fields — notes/owner/source are unreachable even if
--  the schema is exposed; tasks are granted (RLS yields zero rows) so the
--  calendar view's join doesn't error for public readers.
-- ---------------------------------------------------------------------
grant usage on schema events to authenticated, anon;
grant select, insert, update, delete on events.events, events.tasks to authenticated;
grant select (id, title, event_date, starts_at, ends_at, status, visibility, event_type, capacity)
  on events.events to anon;
grant select on events.tasks to anon;
grant select on events.calendar, events.conflicts to authenticated;
grant select on events.feed to authenticated, anon;

-- =====================================================================
--  QUOTES → SPINE INTEGRATION (the first projector; the pattern every
--  module copies — see docs §2 and MODULE-TEMPLATE.md)
-- =====================================================================

-- Parse a time out of the free-text hours field ('09:00–16:00'); never throws.
create or replace function quotes.try_time(t text)
returns time language plpgsql immutable as $$
begin
  return t::time;
exception when others then
  return null;
end; $$;

-- Project one quote into events.events. Idempotent upsert on the provenance
-- key. Quote-sourced events are ALWAYS internal (titles carry customer PII).
-- Guarded: triggers/backfill run it as the acting user or as postgres; a
-- direct caller needs quotes.view (and it is not granted to clients anyway).
create or replace function quotes.project_quote(q quotes.quotes)
returns void language plpgsql security definer
set search_path = quotes, events, finance, core, public
as $$
declare
  v_status text;
  v_starts time;
  v_ends   time;
begin
  if auth.uid() is not null and not core.has_permission('quotes.view') then
    raise exception 'permission denied';
  end if;

  if q.event_confirmed then
    v_status := 'confirmed';               -- archiving history never cancels a confirmed event
  elsif q.status = 'sent' and not q.archived then
    v_status := 'tentative';               -- decision 2026-07-09: pipeline visible, internal
  end if;

  -- No date, or nothing calendar-worthy (draft/declined/expired/archived):
  -- cancel an existing projection and its open money plan, then stop.
  if q.event_date is null or v_status is null then
    update events.events set status = 'cancelled'
    where source_module = 'quotes' and source_id = q.id and status <> 'cancelled';
    if v_status is null then
      update finance.expected set status = 'cancelled'
      where source_module = 'quotes'
        and source_ref in (q.id::text || ':deposit', q.id::text || ':balance')
        and status = 'open';
    end if;
    return;
  end if;

  v_starts := quotes.try_time(substring(q.hours from '^\s*(\d{1,2}[:.]\d{2})'));
  v_ends   := quotes.try_time(substring(q.hours from '(\d{1,2}[:.]\d{2})\s*$'));
  if v_ends is not distinct from v_starts then v_ends := null; end if;

  insert into events.events as ev
    (title, event_date, starts_at, ends_at, status, visibility, event_type,
     source_module, source_id, owner_id)
  values
    (trim(q.customer_name ||
       case when q.event_type <> '' then ' — ' || q.event_type else '' end),
     q.event_date, v_starts, v_ends, v_status, 'internal',
     coalesce(nullif(q.event_type, ''), 'אירוע'), 'quotes', q.id, q.created_by)
  on conflict (source_module, source_id) where source_module is not null
  do update set
    title      = excluded.title,
    event_date = excluded.event_date,
    starts_at  = excluded.starts_at,
    ends_at    = excluded.ends_at,
    event_type = excluded.event_type,
    -- never resurrect past manual lifecycle moves (done/settled), and never
    -- touch visibility/notes/owner — those belong to the calendar side
    status = case when ev.status in ('done','settled') then ev.status
                  else excluded.status end;
end; $$;

create or replace function quotes.project_event()
returns trigger language plpgsql security definer
set search_path = quotes, events, finance, public
as $$
begin
  if tg_op = 'DELETE' then
    -- an unsigned quote can be deleted; its projection goes with it entirely
    delete from events.events where source_module = 'quotes' and source_id = old.id;
    update finance.expected set status = 'cancelled'
    where source_module = 'quotes'
      and source_ref in (old.id::text || ':deposit', old.id::text || ':balance')
      and status = 'open';
    return old;
  end if;
  perform quotes.project_quote(new);
  return new;
end; $$;

drop trigger if exists quotes_quotes_project on quotes.quotes;
create trigger quotes_quotes_project
  after insert or update or delete on quotes.quotes
  for each row execute function quotes.project_event();

-- ---------------------------------------------------------------------
--  The money plan (docs §3c): deposit + balance expectations for a signed
--  quote. One shared body for the signing trigger AND the backfill.
--  Deposit due = signing + N days; N in quotes.settings.quote_defaults
--  ('deposit_due_days', default 7) — owner-editable, no deploy.
-- ---------------------------------------------------------------------
create or replace function quotes.plan_money_for_quote(p_quote uuid)
returns void language plpgsql security definer
set search_path = quotes, events, finance, core, public
as $$
declare
  q         quotes.quotes%rowtype;
  v_event   uuid;
  v_deposit numeric(12,2);
  v_days    int;
begin
  if auth.uid() is not null and not core.has_permission('quotes.contracts') then
    raise exception 'permission denied';
  end if;

  select * into q from quotes.quotes where id = p_quote;
  if not found or q.final_price is null or q.final_price <= 0 then
    return;                                          -- no price, no money plan
  end if;

  select id into v_event from events.events
  where source_module = 'quotes' and source_id = q.id;

  v_days    := coalesce((select (s.quote_defaults->>'deposit_due_days')::int
                         from quotes.settings s where s.id), 7);
  v_deposit := case when coalesce(q.deposit_pct, 0) > 0
                    then round(q.final_price * q.deposit_pct / 100, 2) else 0 end;

  -- Declare this a posting function for the duration of the two inserts, the
  -- same contract finance.record_payment() and pos.post_day() follow. Required
  -- since 54's finance.expected_guard(): 'events' is a quotes-OWNED category,
  -- so a write to it is only legitimate from here — and the guard must decide
  -- that from the GUC, never from the row's own source_module, which any
  -- finance.manage holder could set to 'quotes' themselves.
  perform set_config('levyam.finance_posting', 'on', true);

  if v_deposit > 0 then
    insert into finance.expected
      (direction, category, amount, due_date, reason, event_id, source_module, source_ref)
    values ('in', 'events', v_deposit, current_date + v_days, 'deposit',
            v_event, 'quotes', q.id::text || ':deposit')
    on conflict (source_module, source_ref) where source_module is not null do nothing;
  end if;

  if q.final_price - v_deposit > 0 then
    insert into finance.expected
      (direction, category, amount, due_date, reason, event_id, source_module, source_ref)
    values ('in', 'events', q.final_price - v_deposit, q.event_date, 'balance',
            v_event, 'quotes', q.id::text || ':balance')
    on conflict (source_module, source_ref) where source_module is not null do nothing;
  end if;

  -- back off immediately: the GUC is transaction-local, and leaving it on would
  -- hand the rest of this transaction a free pass through both money guards
  perform set_config('levyam.finance_posting', '', true);
end; $$;

-- Runs AFTER the existing quotes_contracts_confirm trigger (alphabetical
-- firing order: confirm < plan_money), so the quote is already confirmed and
-- its event projected when the plan is written.
create or replace function quotes.plan_money_on_sign()
returns trigger language plpgsql security definer
set search_path = quotes, public
as $$
begin
  if new.status = 'signed' and old.status is distinct from 'signed' then
    perform quotes.plan_money_for_quote(new.quote_id);
  end if;
  return new;
end; $$;

drop trigger if exists quotes_contracts_plan_money on quotes.contracts;
create trigger quotes_contracts_plan_money
  after update on quotes.contracts
  for each row execute function quotes.plan_money_on_sign();

-- ---------------------------------------------------------------------
--  Marking a quote PAID settles its plan: every open expectation fulfills
--  and posts income with provenance — money moves into finance without a
--  human re-typing it. (The finance UI pass makes the manual 'events'
--  income category derived-only so it can't be typed twice — docs §3b.)
-- ---------------------------------------------------------------------
create or replace function quotes.settle_on_paid()
returns trigger language plpgsql security definer
set search_path = quotes, finance, public
as $$
declare
  exp         record;
  v_entry     uuid;
  v_remaining numeric(12,2);
  v_seq       int;
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    perform set_config('levyam.finance_posting', 'on', true);
    for exp in
      select * from finance.expected
      where source_module = 'quotes'
        and source_ref in (new.id::text || ':deposit', new.id::text || ':balance')
        and status = 'open'
      order by due_date nulls last
      for update
    loop
      -- Settle only what is still OWED. Before partial payments existed this
      -- posted exp.amount unconditionally, so a deposit already part-paid
      -- through record_payment() would post a second time at its FULL value
      -- when the quote flipped to 'paid' — double-counting the income.
      v_remaining := exp.amount - exp.paid_amount;
      -- Already fully paid but still flagged open (an audited owner edit can
      -- leave it that way): settle the STATUS and move on. Skipping outright
      -- left it in the open list and reconciliation's overdue check forever,
      -- reported as overdue for 0 ₪.
      if v_remaining <= 0 then
        update finance.expected set status = 'fulfilled' where id = exp.id;
        continue;
      end if;

      -- Own ':pN' slot in the same grammar record_payment() uses, so a
      -- settlement following a partial payment cannot collide with it.
      select count(*) + 1 into v_seq
        from finance.entries
       where source_module = 'quotes'
         and source_ref like 'expected:' || exp.id || '%';

      insert into finance.entries
        (kind, category, amount, entry_date, note, source_module, source_ref, event_id)
      values
        ('income', exp.category, v_remaining, coalesce(new.paid_date, current_date),
         exp.reason || ' — ' || new.customer_name || ' (' || new.quote_number || ')',
         'quotes', 'expected:' || exp.id || ':p' || v_seq, exp.event_id)
      -- No `on conflict do nothing` any more. With a counted ':pN' ref the value
      -- is fresh by construction, so the conflict arm could only fire on a state
      -- that entries_guard makes impossible — and its silent outcome was the bad
      -- one: v_entry stays null, the expectation stays open, and a quote already
      -- marked `paid` quietly has no income posted against it. Idempotency now
      -- rests on `status = 'open'` plus the cursor's FOR UPDATE lock (both above)
      -- and on the `continue when v_remaining <= 0` guard, so a genuine unique
      -- violation here means a real invariant broke and must fail loudly —
      -- matching how record_payment() treats the same impossible case.
      returning id into v_entry;
      update finance.expected
      set status = 'fulfilled', fulfilled_by = v_entry, paid_amount = exp.amount
      where id = exp.id;
    end loop;
    perform set_config('levyam.finance_posting', '', true);
  end if;
  return new;
end; $$;

drop trigger if exists quotes_quotes_settle on quotes.quotes;
create trigger quotes_quotes_settle
  after update on quotes.quotes
  for each row execute function quotes.settle_on_paid();

-- ---------------------------------------------------------------------
--  Backfill — every projector ships one (docs §6 rule 3). Idempotent.
--  Projects ALL existing quotes; creates expectations only for signed,
--  unpaid, FUTURE events (auto-posting the past would double-count the
--  manual finance entries the owner already typed — history stays manual).
--  Callable by events.manage holders from the app, or as postgres from the
--  SQL editor / management API.
-- ---------------------------------------------------------------------
create or replace function quotes.backfill_events()
returns jsonb language plpgsql security definer
set search_path = quotes, events, finance, core, public
as $$
declare
  q           quotes.quotes%rowtype;
  v_projected int := 0;
  v_planned   int := 0;
begin
  if auth.uid() is not null and not core.has_permission('events.manage') then
    raise exception 'permission denied';
  end if;

  for q in select * from quotes.quotes loop
    perform quotes.project_quote(q);
    v_projected := v_projected + 1;

    if q.event_confirmed and q.status <> 'paid'
       and q.event_date is not null and q.event_date >= current_date
       and exists (select 1 from quotes.contracts c
                   where c.quote_id = q.id and c.status = 'signed') then
      perform quotes.plan_money_for_quote(q.id);
      v_planned := v_planned + 1;
    end if;
  end loop;

  return jsonb_build_object('projected', v_projected, 'money_planned', v_planned);
end; $$;

-- Internal helpers are not client-callable; the guarded backfill is.
revoke execute on function quotes.project_quote(quotes.quotes) from public, authenticated, anon;
revoke execute on function quotes.plan_money_for_quote(uuid)   from public, authenticated, anon;
revoke execute on function quotes.backfill_events()             from public;
grant  execute on function quotes.backfill_events() to authenticated;
-- Internal helper used by the projection triggers; kept executable by
-- `authenticated` because the non-definer triggers call it as the invoker.
revoke all    on function quotes.try_time(text) from public;
grant  execute on function quotes.try_time(text) to authenticated;

-- =====================================================================
--  SEED DATA (idempotent — safe to re-run)
-- =====================================================================

-- Registered DISABLED: permissions need the module key (FK), but the launcher
-- must not show a tile until the Phase 2 calendar UI exists (my_modules()
-- filters on enabled).
insert into core.modules (key, label, icon, enabled, sort) values
  ('events', 'יומן ואירועים', '📅', false, 25)
on conflict (key) do nothing;

insert into core.permissions (key, module, action, label) values
  ('events.view',   'events', 'view',   'צפייה ביומן ובאירועים'),
  ('events.manage', 'events', 'manage', 'יצירה ועריכה של אירועים'),
  ('events.tasks',  'events', 'tasks',  'סימון וניהול משימות הכנה')
on conflict (key) do nothing;

-- owner + manager: everything; staff: see the calendar + work the prep tasks
insert into core.role_permissions (role_id, permission_id)
select r.id, p.id from core.roles r join core.permissions p
  on p.key in ('events.view','events.manage','events.tasks')
where r.key in ('owner','manager')
on conflict do nothing;

insert into core.role_permissions (role_id, permission_id)
select r.id, p.id from core.roles r join core.permissions p
  on p.key in ('events.view','events.tasks')
where r.key = 'staff'
on conflict do nothing;
