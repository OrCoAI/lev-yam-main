-- =====================================================================
--  Lev Yam platform — QUOTES module (price quotes → contracts → confirmed events)
--  Run in the Supabase SQL editor AFTER 00_core.sql, then add `quotes` under
--  Supabase → Settings → API → Exposed schemas.
--
--  Migration target of the local quotes app (~/lev-yam-quotes, serve.py) —
--  see docs/plans/quotes-module.md. The app's load-bearing invariants live
--  HERE, not in UI code:
--    * one contract per quote            → UNIQUE FK
--    * signed contract is immutable      → trigger blocks UPDATE/DELETE
--      (this also blocks deleting a quote whose contract is signed — the
--      cascade hits the trigger; a signed contract is a legal record)
--    * signing confirms the event        → trigger: quote → approved,
--      event_confirmed, prep checklist seeded from settings
--    * sent/paid dates stamp once        → trigger, never overwritten
--    * quote numbering LY-YYMMDD-NNN     → sequence-backed column default
--  Money/PII lives here under RLS — never in the (public) repo.
-- =====================================================================

create schema if not exists quotes;

-- Global sequence part of LY-YYMMDD-NNN. Seeded from the tracker at creation
-- time; the live value now advances in prod (data import completed 2026-07-09)
-- and `if not exists` keeps re-runs from ever resetting it.
create sequence if not exists quotes.quote_number_seq start with 17;

-- SECURITY DEFINER + core.require gate (H7 hardening, 2026-07-15): the
-- function stays executable by authenticated because it runs as the
-- quote_number column DEFAULT (defaults evaluate as the inserting user), but
-- a client JWT must hold quotes.manage to actually draw a number — an anon or
-- under-privileged RPC call raises instead of silently burning sequence
-- numbers. No-JWT callers (SQL editor, service_role) pass, so server-side
-- inserts relying on the DEFAULT keep working. Sequence access itself is
-- definer-side only (grant revoked below).
create or replace function quotes.next_quote_number()
returns text language plpgsql volatile security definer
set search_path = quotes, public
as $$
begin
  perform core.require('quotes.manage');
  return 'LY-' || to_char(current_date, 'YYMMDD') || '-'
       || lpad(nextval('quotes.quote_number_seq')::text, 3, '0');
end;
$$;

-- ---------------------------------------------------------------------
--  quotes.quotes — one row per quote; `content` is the document body
--  (greeting, line items, included list, agenda, cancellation, terms)
-- ---------------------------------------------------------------------
create table if not exists quotes.quotes (
  id              uuid primary key default gen_random_uuid(),
  quote_number    text not null unique default quotes.next_quote_number(),
  customer_name   text not null,
  contact_person  text not null default '',
  phone           text not null default '',
  email           text not null default '',
  event_type      text not null default '',
  event_date      date,
  guests          text not null default '',      -- free text on purpose ('25', '20–30')
  hours           text not null default '',      -- '09:00–16:00'
  issue_date      date not null default current_date,
  status          text not null default 'draft'
                  check (status in ('draft','sent','approved','declined','expired','paid')),
  sent_date       date,                          -- stamped once on first move to 'sent'
  paid_date       date,                          -- stamped once on first move to 'paid'
  archived        boolean not null default false,
  event_confirmed boolean not null default false,
  notes           text not null default '',
  subtotal        numeric(12,2),
  discount_pct    numeric(5,2),
  final_price     numeric(12,2),
  vat_rate        numeric(4,3),
  deposit_pct     numeric(5,2),
  content         jsonb not null default '{}'::jsonb,
  prep_checklist  jsonb not null default '[]'::jsonb,  -- [{text, done}]
  created_by      uuid not null default auth.uid() references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists quotes_quotes_event_date_idx on quotes.quotes (event_date);
create index if not exists quotes_quotes_status_idx     on quotes.quotes (status);
create index if not exists quotes_quotes_issue_date_idx on quotes.quotes (issue_date desc);

-- ---------------------------------------------------------------------
--  quotes.contracts — at most ONE per quote (UNIQUE FK); `content` is the
--  clauses + details snapshot taken at generation time (a contract must not
--  change retroactively when the master template is edited)
-- ---------------------------------------------------------------------
create table if not exists quotes.contracts (
  id                uuid primary key default gen_random_uuid(),
  quote_id          uuid not null unique references quotes.quotes(id) on delete cascade,
  contract_number   text not null unique,        -- 'C-' + quote_number (derived by trigger)
  status            text not null default 'draft'
                    check (status in ('draft','sent','signed')),
  generated_date    date not null default current_date,
  sent_date         date,
  signed_date       date,
  signed_name       text,
  signed_at         timestamptz,
  signer_ip         text,
  signer_user_agent text,
  content           jsonb not null default '{}'::jsonb,
  document_path     text,                        -- immutable PDF/HTML snapshot in private Storage
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  quotes.settings — single row of owner-editable defaults (checklist
--  template, quote document defaults, contract clause/fields template).
--  The lessor signature is deliberately NOT here — see owner_secrets.
-- ---------------------------------------------------------------------
create table if not exists quotes.settings (
  id                      boolean primary key default true check (id),
  default_prep_checklist  jsonb not null default '[]'::jsonb,  -- [string, ...]
  quote_defaults          jsonb not null default '{}'::jsonb,
  contract_template       jsonb not null default '{}'::jsonb,
  updated_at              timestamptz not null default now()
);
insert into quotes.settings (id) values (true) on conflict do nothing;

-- quotes.owner_secrets — the lessor's signature (data URL), baked into
-- generated contracts. Separate table so RLS can gate it more strictly
-- than the rest of settings ('quotes.settings' permission only).
create table if not exists quotes.owner_secrets (
  id              boolean primary key default true check (id),
  owner_signature text not null default '',
  updated_at      timestamptz not null default now()
);
insert into quotes.owner_secrets (id) values (true) on conflict do nothing;

-- ---------------------------------------------------------------------
--  Triggers — behavior parity with serve.py, enforced in the DB
-- ---------------------------------------------------------------------
create or replace function quotes.touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists quotes_quotes_touch on quotes.quotes;
create trigger quotes_quotes_touch
  before update on quotes.quotes
  for each row execute function quotes.touch();

drop trigger if exists quotes_contracts_touch on quotes.contracts;
create trigger quotes_contracts_touch
  before update on quotes.contracts
  for each row execute function quotes.touch();

drop trigger if exists quotes_settings_touch on quotes.settings;
create trigger quotes_settings_touch
  before update on quotes.settings
  for each row execute function quotes.touch();

drop trigger if exists quotes_owner_secrets_touch on quotes.owner_secrets;
create trigger quotes_owner_secrets_touch
  before update on quotes.owner_secrets
  for each row execute function quotes.touch();

-- One-way date stamps on quotes (mirror of serve.py's sentDate/paidDate).
create or replace function quotes.stamp_quote_dates()
returns trigger language plpgsql as $$
begin
  if new.status = 'sent' and old.status is distinct from 'sent' and new.sent_date is null then
    new.sent_date := current_date;
  end if;
  if new.status = 'paid' and old.status is distinct from 'paid' and new.paid_date is null then
    new.paid_date := current_date;
  end if;
  return new;
end; $$;

drop trigger if exists quotes_quotes_stamp on quotes.quotes;
create trigger quotes_quotes_stamp
  before update on quotes.quotes
  for each row execute function quotes.stamp_quote_dates();

-- Contract number derives from the quote; signed contracts are immutable.
create or replace function quotes.contract_before_write()
returns trigger language plpgsql
set search_path = quotes, public
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'signed' then
      raise exception 'הסכם חתום הוא מסמך משפטי — לא ניתן למחוק אותו.';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' or new.quote_id is distinct from old.quote_id then
    select 'C-' || q.quote_number into new.contract_number
    from quotes.quotes q where q.id = new.quote_id;
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'signed' then
      raise exception 'הסכם זה כבר נחתם — לא ניתן לשנות אותו.';
    end if;
    if new.status = 'sent' and old.status is distinct from 'sent' and new.sent_date is null then
      new.sent_date := current_date;
    end if;
    if new.status = 'signed' and new.signed_date is null then
      new.signed_date := current_date;
    end if;
  end if;

  return new;
end; $$;

drop trigger if exists quotes_contracts_guard on quotes.contracts;
create trigger quotes_contracts_guard
  before insert or update or delete on quotes.contracts
  for each row execute function quotes.contract_before_write();

-- Signing confirms the event (both flows: online sign or PDF round-trip
-- marked signed): quote → approved + event_confirmed, prep checklist seeded
-- from settings. SECURITY DEFINER: the signer holds 'quotes.contracts' but
-- not necessarily 'quotes.manage'; this controlled write is the one exception.
create or replace function quotes.confirm_event_on_sign()
returns trigger language plpgsql security definer
set search_path = quotes, public
as $$
declare
  default_checklist jsonb;
begin
  if new.status = 'signed' and old.status is distinct from 'signed' then
    select coalesce(
      (select jsonb_agg(jsonb_build_object('text', item, 'done', false))
       from jsonb_array_elements_text(s.default_prep_checklist) as item),
      '[]'::jsonb)
    into default_checklist
    from quotes.settings s where s.id;

    update quotes.quotes q
    set status = 'approved',
        event_confirmed = true,
        prep_checklist = case
          when q.prep_checklist = '[]'::jsonb then coalesce(default_checklist, '[]'::jsonb)
          else q.prep_checklist
        end
    where q.id = new.quote_id;
  end if;
  return new;
end; $$;

drop trigger if exists quotes_contracts_confirm on quotes.contracts;
create trigger quotes_contracts_confirm
  after update on quotes.contracts
  for each row execute function quotes.confirm_event_on_sign();

-- ---------------------------------------------------------------------
--  quotes.auto_expire() — lazy sweep called on module load (parity with
--  serve.py): 'sent' quotes expire 7+ days after sent_date (legacy rows
--  without one fall back to issue_date). Drafts are never swept.
--  SECURITY DEFINER so a viewer's page load can run the sweep; the guard
--  inside requires quotes.view.
-- ---------------------------------------------------------------------
create or replace function quotes.auto_expire()
returns integer language plpgsql security definer
set search_path = quotes, core, public
as $$
declare
  expired_count integer;
begin
  if not core.has_permission('quotes.view') then
    raise exception 'permission denied';
  end if;
  update quotes.quotes
  set status = 'expired'
  where status = 'sent'
    and coalesce(sent_date, issue_date) <= current_date - 7;
  get diagnostics expired_count = row_count;
  return expired_count;
end; $$;

-- ---------------------------------------------------------------------
--  Row-Level Security — the database is the real guard, UI is convenience
-- ---------------------------------------------------------------------
alter table quotes.quotes        enable row level security;
alter table quotes.contracts     enable row level security;
alter table quotes.settings      enable row level security;
alter table quotes.owner_secrets enable row level security;

drop policy if exists "quotes_quotes_select" on quotes.quotes;
drop policy if exists "quotes_quotes_write"  on quotes.quotes;
-- (select ...) wrapper = one InitPlan eval per statement, not per row (MODULE-TEMPLATE.md §1)
create policy "quotes_quotes_select" on quotes.quotes for select to authenticated
  using ((select core.has_permission('quotes.view')));
create policy "quotes_quotes_write" on quotes.quotes for all to authenticated
  using ((select core.has_permission('quotes.manage')))
  with check ((select core.has_permission('quotes.manage')));

drop policy if exists "quotes_contracts_select" on quotes.contracts;
drop policy if exists "quotes_contracts_write"  on quotes.contracts;
create policy "quotes_contracts_select" on quotes.contracts for select to authenticated
  using ((select core.has_permission('quotes.view')));
create policy "quotes_contracts_write" on quotes.contracts for all to authenticated
  using ((select core.has_permission('quotes.contracts')))
  with check ((select core.has_permission('quotes.contracts')));

drop policy if exists "quotes_settings_select" on quotes.settings;
drop policy if exists "quotes_settings_write"  on quotes.settings;
create policy "quotes_settings_select" on quotes.settings for select to authenticated
  using ((select core.has_permission('quotes.view')));
create policy "quotes_settings_write" on quotes.settings for update to authenticated
  using ((select core.has_permission('quotes.settings')))
  with check ((select core.has_permission('quotes.settings')));

-- signature: strictly 'quotes.settings' holders, read AND write
drop policy if exists "quotes_secrets_select" on quotes.owner_secrets;
drop policy if exists "quotes_secrets_write"  on quotes.owner_secrets;
create policy "quotes_secrets_select" on quotes.owner_secrets for select to authenticated
  using ((select core.has_permission('quotes.settings')));
create policy "quotes_secrets_write" on quotes.owner_secrets for update to authenticated
  using ((select core.has_permission('quotes.settings')))
  with check ((select core.has_permission('quotes.settings')));

-- ---------------------------------------------------------------------
--  Grants (RLS still gates every statement)
-- ---------------------------------------------------------------------
grant usage on schema quotes to authenticated;
grant select, insert, update, delete on quotes.quotes    to authenticated;
grant select, insert, update, delete on quotes.contracts to authenticated;
grant select, update on quotes.settings      to authenticated;
grant select, update on quotes.owner_secrets to authenticated;
-- The sequence is reachable only through next_quote_number()'s definer rights;
-- a direct client nextval() would burn numbers past the permission check.
revoke usage on sequence quotes.quote_number_seq from authenticated;
grant execute on function quotes.next_quote_number() to authenticated;
grant execute on function quotes.auto_expire() to authenticated;

-- =====================================================================
--  SEED DATA (idempotent — safe to re-run)
-- =====================================================================
insert into core.modules (key, label, icon, sort) values
  ('quotes', 'הצעות מחיר', '📋', 40)
on conflict (key) do nothing;

insert into core.permissions (key, module, action, label) values
  ('quotes.view',      'quotes', 'view',      'צפייה בהצעות מחיר, הסכמים ואירועים'),
  ('quotes.manage',    'quotes', 'manage',    'יצירה ועריכה של הצעות מחיר'),
  ('quotes.contracts', 'quotes', 'contracts', 'הפקה, שליחה וסימון חתימה של הסכמים'),
  ('quotes.settings',  'quotes', 'settings',  'הגדרות המודול: חתימה, תבניות, רשימת הכנות')
on conflict (key) do nothing;

-- owner + manager: everything; staff/viewer intentionally not granted quotes.* in v1
insert into core.role_permissions (role_id, permission_id)
select r.id, p.id from core.roles r join core.permissions p
  on p.key in ('quotes.view','quotes.manage','quotes.contracts','quotes.settings')
where r.key in ('owner','manager')
on conflict do nothing;
