-- =====================================================================
--  48_pos_day_lifecycle.sql — write-to-books + automatic re-post.
--  (PR E of POS operations v2)
--
--  The first write to the books stays manual (pos.close_day, a manager
--  action). After that, any change to a booked day's money re-runs the
--  posting automatically and writes the correcting delta, so the books
--  never drift. Builds on pos.post_day (PR C — the permission-free
--  posting core).
--
--  Re-runnable; apply in the Supabase SQL editor after 47.
--  Plan: docs/plans/pos-day-lifecycle.md
-- =====================================================================

-- ---------------------------------------------------------------------
--  1) Has this day already been written to the books?
-- ---------------------------------------------------------------------
-- The one place that encodes the finance source_ref grammar authored by
-- pos.post_day (47): 'pos:<date>:<leg>[:r<n>]'. Both readers below LIKE against
-- this prefix, so the format lives in a single spot.
create or replace function pos.day_ref_prefix(p_date date)
returns text language sql immutable as $$ select 'pos:' || p_date || ':'; $$;

create or replace function pos.day_is_posted(p_date date)
returns boolean language sql stable security definer set search_path = pos, finance as $$
  select exists (
    select 1 from finance.entries
    where source_module = 'pos' and source_ref like pos.day_ref_prefix(p_date) || '%');
$$;

-- Re-post a day, but only if it has already been booked (the first post is a
-- deliberate manual act). post_day writes only the delta, so this is a no-op
-- when nothing changed.
create or replace function pos.repost_if_posted(p_date date)
returns void language plpgsql security definer set search_path = pos, finance, core as $$
begin
  if p_date is not null and pos.day_is_posted(p_date) then
    perform pos.post_day(p_date);
  end if;
end; $$;

-- ---------------------------------------------------------------------
--  2) Auto re-post trigger — fires on every table post_day reads:
--     payments (revenue, new bills), expenses (food/labor), AND pos_bills
--     (revenue for LEGACY / fallback-close bills that have no payment rows —
--     see the two-source revenue read in pos.post_day, 47). Keyed by the
--     table's own date column (business_date / taken_at / paid_at).
--     Suppressed inside pos_close_table (which does its own single re-post
--     at the end, covering the bill's paid_at day too) so a multi-row close
--     doesn't fan out.
-- ---------------------------------------------------------------------
create or replace function pos.autorepost()
returns trigger language plpgsql security definer set search_path = pos, finance, core as $$
declare d_old date; d_new date;
begin
  if coalesce(current_setting('levyam.suppress_repost', true), '') = 'on' then
    return null;
  end if;

  if TG_TABLE_NAME = 'pos_expenses' then
    if TG_OP <> 'INSERT' then d_old := OLD.business_date; end if;
    if TG_OP <> 'DELETE' then d_new := NEW.business_date; end if;
  elsif TG_TABLE_NAME = 'pos_bills' then
    if TG_OP <> 'INSERT' then d_old := (OLD.paid_at at time zone 'Asia/Jerusalem')::date; end if;
    if TG_OP <> 'DELETE' then d_new := (NEW.paid_at at time zone 'Asia/Jerusalem')::date; end if;
  else -- pos_payments
    if TG_OP <> 'INSERT' then d_old := (OLD.taken_at at time zone 'Asia/Jerusalem')::date; end if;
    if TG_OP <> 'DELETE' then d_new := (NEW.taken_at at time zone 'Asia/Jerusalem')::date; end if;
  end if;

  perform pos.repost_if_posted(d_new);
  if d_old is distinct from d_new then perform pos.repost_if_posted(d_old); end if;
  return null;
end; $$;

drop trigger if exists pos_payments_autorepost on pos.pos_payments;
create trigger pos_payments_autorepost after insert or update or delete on pos.pos_payments
for each row execute function pos.autorepost();

drop trigger if exists pos_expenses_autorepost on pos.pos_expenses;
create trigger pos_expenses_autorepost after insert or update or delete on pos.pos_expenses
for each row execute function pos.autorepost();

-- pos_bills: a payment-less bill's money lives on the bill, so a close (insert),
-- reopen (delete), or money-changing edit must re-post its paid_at day. INSERT/
-- DELETE always fire; UPDATE fires only when a revenue-relevant column moves —
-- so the bulk archived_at "clear day" sweep (which post_day ignores) doesn't
-- trigger a storm of no-op re-posts.
drop trigger if exists pos_bills_autorepost_id on pos.pos_bills;
create trigger pos_bills_autorepost_id after insert or delete on pos.pos_bills
for each row execute function pos.autorepost();

drop trigger if exists pos_bills_autorepost_upd on pos.pos_bills;
create trigger pos_bills_autorepost_upd after update on pos.pos_bills
for each row when (
  old.status      is distinct from new.status      or
  old.grand_total is distinct from new.grand_total or
  old.cash_paid   is distinct from new.cash_paid    or
  old.card_paid   is distinct from new.card_paid    or
  old.paid_at     is distinct from new.paid_at
) execute function pos.autorepost();

-- ---------------------------------------------------------------------
--  3) Day posting status for the report badge.
-- ---------------------------------------------------------------------
create or replace function pos.day_status(p_date date)
returns jsonb language plpgsql security definer set search_path = pos, finance, core as $$
begin
  perform pos.require('pos.reports');
  return jsonb_build_object(
    'posted', pos.day_is_posted(p_date),
    -- corrections carry a ':r<n>' suffix on the source_ref (post_day)
    'corrected', exists (
      select 1 from finance.entries
      where source_module = 'pos' and source_ref like pos.day_ref_prefix(p_date) || '%:r%'));
end; $$;

-- ---------------------------------------------------------------------
--  4) Grants — day_status is client-callable (reports holders); the rest
--     are internal (triggers run as the definer owner). Revoke the
--     PUBLIC-execute default first (see PR B).
-- ---------------------------------------------------------------------
revoke all on function pos.day_ref_prefix(date)    from public, anon, authenticated;
revoke all on function pos.day_is_posted(date)     from public, anon, authenticated;
revoke all on function pos.repost_if_posted(date)  from public, anon, authenticated;
revoke all on function pos.autorepost()            from public, anon, authenticated;
revoke all on function pos.day_status(date)        from public, anon;
grant  execute on function pos.day_status(date)    to authenticated;
