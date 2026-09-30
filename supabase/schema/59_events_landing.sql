-- =====================================================================
--  Lev Yam platform — "WHAT'S HAPPENING" LANDING PAGES (PR 2)
--  Run AFTER 58_events_public.sql. Idempotent; safe to re-run.
--  Plan: docs/plans/events-whats-happening.md "PR 2 — the landing pages"
--  · ADR 0056.
--
--  What this adds:
--    * Two optional structured fields per item, HE + AR each: who the item
--      is for (audience_*) and what to bring / where to meet (bring_*).
--      A public row fills each one in both languages or in neither
--      (invariant 5 for every shown text) — CHECK, not form logic.
--    * events.feed gains the four columns; the anon column grants follow.
--    * events.passed — a second anon-readable view: public items whose last
--      occurrence passed within the last 90 days, the same public columns.
--      The generated landing page of such an item stays up, noindex, with a
--      "this one has passed" banner instead of a dead link (ADR 0056 §6).
--    * events.valid_image_paths(id, paths) now pins every photo to the row's
--      own <id>/ prefix, so two rows can never reference (and on removal
--      delete) one object — the open question from PR 1's gate.
--
--  Re-running 58 after this file re-creates the one-argument
--  valid_image_paths(text[]) overload (harmless, unused) and its `create
--  view events.feed` is a `drop view` + `create`, so run 58 then 59, in order.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1) The two optional fields
-- ---------------------------------------------------------------------
alter table events.events add column if not exists audience_he text not null default '';
alter table events.events add column if not exists audience_ar text not null default '';
alter table events.events add column if not exists bring_he    text not null default '';
alter table events.events add column if not exists bring_ar    text not null default '';

-- Public ⇒ an optional line is shown in both languages or not at all.
do $$ begin
  alter table events.events add constraint events_public_optional_bilingual
    check (visibility <> 'public'
           or ((btrim(audience_he) = '') = (btrim(audience_ar) = '')
               and (btrim(bring_he) = '') = (btrim(bring_ar) = '')));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
--  2) Photos belong to their row. 58 accepted any <uuid>/ prefix, so a row
--     written by hand could reference another item's object and, on
--     removal, delete it. The helper now takes the row's id.
-- ---------------------------------------------------------------------
alter table events.events drop constraint if exists events_image_paths_valid;
drop function if exists events.valid_image_paths(text[]);

create or replace function events.valid_image_paths(id uuid, paths text[])
returns boolean language sql immutable
set search_path = pg_catalog
as $$
  select coalesce(bool_and(p ~ ('^' || id::text || '/[a-z0-9-]+\.(jpg|jpeg|png|webp)$')), true)
  from unnest(paths) as p
$$;

do $$ begin
  alter table events.events add constraint events_image_paths_valid
    check (cardinality(image_paths) <= 8 and events.valid_image_paths(id, image_paths));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
--  3) The public feed, with the two fields
-- ---------------------------------------------------------------------
drop view if exists events.feed;
create view events.feed with (security_invoker = true) as
  select e.id, e.title, e.event_date, e.starts_at, e.ends_at, e.status,
         e.event_type, e.capacity,
         e.slug, e.title_he, e.title_ar, e.summary_he, e.summary_ar,
         e.body_he, e.body_ar, e.image_paths, e.story_slug,
         e.recur_weekdays, e.recur_until,
         e.audience_he, e.audience_ar, e.bring_he, e.bring_ar,
         n.next_date
  from events.events e
  cross join lateral (
    select events.next_occurrence(e.event_date, e.recur_weekdays, e.recur_until) as next_date
  ) n
  where e.visibility = 'public'
    and e.status in ('confirmed', 'in_progress')
    and n.next_date is not null;

grant select (audience_he, audience_ar, bring_he, bring_ar) on events.events to anon;
grant select on events.feed to authenticated, anon;

-- ---------------------------------------------------------------------
--  4) events.passed — recently over, still public. Same columns as the feed
--     (last_date in place of next_date). A dated item's last date is its
--     date; a recurring item's is its end date, so an open-ended recurring
--     item never passes (its next occurrence is never null either).
--     90 days, then the page is gone and 404.html sends /happening/* home.
-- ---------------------------------------------------------------------
drop view if exists events.passed;
create view events.passed with (security_invoker = true) as
  select e.id, e.title, e.event_date, e.starts_at, e.ends_at, e.status,
         e.event_type, e.capacity,
         e.slug, e.title_he, e.title_ar, e.summary_he, e.summary_ar,
         e.body_he, e.body_ar, e.image_paths, e.story_slug,
         e.recur_weekdays, e.recur_until,
         e.audience_he, e.audience_ar, e.bring_he, e.bring_ar,
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

grant select on events.passed to authenticated, anon;
