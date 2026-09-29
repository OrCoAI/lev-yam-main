-- =====================================================================
--  Lev Yam platform — "WHAT'S HAPPENING": COST + BOOKING, NO STORY LINK
--  (PR 2, the owner's localhost review). Run AFTER 59_events_landing.sql.
--  Idempotent; safe to re-run. Plan: docs/plans/events-whats-happening.md.
--
--    * cost_he / cost_ar: free text ("חינם", "60 ₪ לאדם", …), optional,
--      shown in both languages or in neither on a public row — the same
--      CHECK as the other optional lines (invariant 5), extended here.
--    * booking_required: a flag, rendered as one fixed line per language.
--    * The link from an item to a /stories/ pair is REMOVED: an item's page
--      is its own detail page, so the body is required for every public
--      item. The column, its format CHECK and the story clause of
--      events.publishable() go; a public row that was publishable only
--      through a story link is demoted to internal (reported).
--    * events.feed / events.passed are recreated with the three new columns
--      and without story_slug; anon's column grants follow. Re-running 58
--      or 59 after this file would bring story_slug back — run 58, 59, 60
--      in order (the baseline does).
-- =====================================================================

-- ---------------------------------------------------------------------
--  1) Cost + booking
-- ---------------------------------------------------------------------
alter table events.events add column if not exists cost_he text not null default '';
alter table events.events add column if not exists cost_ar text not null default '';
alter table events.events add column if not exists booking_required boolean not null default false;

-- Public ⇒ every optional line is shown in both languages or not at all.
alter table events.events drop constraint if exists events_public_optional_bilingual;
alter table events.events add constraint events_public_optional_bilingual
  check (visibility <> 'public'
         or ((btrim(audience_he) = '') = (btrim(audience_ar) = '')
             and (btrim(bring_he) = '') = (btrim(bring_ar) = '')
             and (btrim(cost_he) = '') = (btrim(cost_ar) = '')));

-- ---------------------------------------------------------------------
--  2) The story link goes. The views depend on the column, the bilingual
--     CHECK on the old publishable() signature — both are rebuilt below.
-- ---------------------------------------------------------------------
drop view if exists events.feed;
drop view if exists events.passed;
alter table events.events drop constraint if exists events_public_bilingual;
alter table events.events drop constraint if exists events_story_slug_format;
drop function if exists events.publishable(text, text, text, text, text, text, text, text);

-- Public ⇒ slug, title, summary and body in both languages (invariant 5).
create or replace function events.publishable(
  slug text, title_he text, title_ar text, summary_he text, summary_ar text,
  body_he text, body_ar text)
returns boolean language sql immutable
set search_path = pg_catalog
as $$
  select slug is not null
     and btrim(title_he) <> ''   and btrim(title_ar) <> ''
     and btrim(summary_he) <> '' and btrim(summary_ar) <> ''
     and btrim(body_he) <> ''    and btrim(body_ar) <> ''
$$;

do $$
declare n int;
begin
  update events.events set visibility = 'internal'
  where visibility = 'public'
    and not events.publishable(slug, title_he, title_ar, summary_he, summary_ar, body_he, body_ar);
  get diagnostics n = row_count;
  if n > 0 then
    raise notice '60_events_cost: % public row(s) had no body of their own (they linked a story) — demoted to internal', n;
  end if;
end $$;

alter table events.events drop column if exists story_slug;

alter table events.events add constraint events_public_bilingual
  check (visibility <> 'public' or events.publishable(
    slug, title_he, title_ar, summary_he, summary_ar, body_he, body_ar));

-- ---------------------------------------------------------------------
--  3) The public views, with the three new columns and without the link
-- ---------------------------------------------------------------------
create view events.feed with (security_invoker = true) as
  select e.id, e.title, e.event_date, e.starts_at, e.ends_at, e.status,
         e.event_type, e.capacity,
         e.slug, e.title_he, e.title_ar, e.summary_he, e.summary_ar,
         e.body_he, e.body_ar, e.image_paths,
         e.recur_weekdays, e.recur_until,
         e.audience_he, e.audience_ar, e.bring_he, e.bring_ar,
         e.cost_he, e.cost_ar, e.booking_required,
         n.next_date
  from events.events e
  cross join lateral (
    select events.next_occurrence(e.event_date, e.recur_weekdays, e.recur_until) as next_date
  ) n
  where e.visibility = 'public'
    and e.status in ('confirmed', 'in_progress')
    and n.next_date is not null;

create view events.passed with (security_invoker = true) as
  select e.id, e.title, e.event_date, e.starts_at, e.ends_at, e.status,
         e.event_type, e.capacity,
         e.slug, e.title_he, e.title_ar, e.summary_he, e.summary_ar,
         e.body_he, e.body_ar, e.image_paths,
         e.recur_weekdays, e.recur_until,
         e.audience_he, e.audience_ar, e.bring_he, e.bring_ar,
         e.cost_he, e.cost_ar, e.booking_required,
         l.last_date
  from events.events e
  cross join lateral (
    select case when e.recur_weekdays is null then e.event_date else e.recur_until end as last_date
  ) l
  where e.visibility = 'public'
    and e.status in ('confirmed', 'in_progress')
    and events.next_occurrence(e.event_date, e.recur_weekdays, e.recur_until) is null
    and l.last_date is not null
    and l.last_date >= (now() at time zone 'Asia/Jerusalem')::date - 90;

grant select (cost_he, cost_ar, booking_required) on events.events to anon;
grant select on events.feed to authenticated, anon;
grant select on events.passed to authenticated, anon;
