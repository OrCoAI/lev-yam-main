-- =====================================================================
--  Lev Yam platform — PUBLIC "WHAT'S HAPPENING" on the events spine
--  Run AFTER 40_events.sql and 50_storage.sql. Idempotent; safe to re-run.
--  Plan: docs/plans/events-whats-happening.md · ADR 0054.
--
--  What this adds:
--    * events.events gains the public-page fields: a URL slug, HE + AR
--      title / summary / body, an ordered photo gallery (first = cover, up
--      to 8), an optional link to a static story pair, and a weekly
--      recurrence (weekdays + optional end date).
--    * CHECKs that make "public" mean "publishable": a public row must carry
--      both languages (invariant 5 in the DB, not in the form), its Arabic
--      must not be an unconfirmed machine draft, and a quote-sourced row can
--      never be public (its title is a customer name).
--    * events.feed rewritten to the LIVE rule — a dated item until its date
--      passes, a recurring item until its end date — with its next date
--      computed in Asia/Jerusalem. Anon column grants widened to exactly the
--      new public columns.
--    * Staff with events.view no longer see quote-sourced events unless they
--      also hold quotes.view: exposing the schema to the API (this initiative)
--      would otherwise hand customer names to every staff account.
--    * Storage bucket `events-public` (public read, events.manage writes).
--    * The `events` module tile is enabled.
--
--  Recreating events.feed here means re-running 40_events.sql alone on a DB
--  that already has this file applied fails at its `create or replace view
--  events.feed` (fewer columns). Re-run 40 and then this file, in order.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1) Columns
-- ---------------------------------------------------------------------
alter table events.events add column if not exists slug           text;
alter table events.events add column if not exists title_he       text not null default '';
alter table events.events add column if not exists title_ar       text not null default '';
alter table events.events add column if not exists summary_he     text not null default '';
alter table events.events add column if not exists summary_ar     text not null default '';
alter table events.events add column if not exists body_he        text not null default '';
alter table events.events add column if not exists body_ar        text not null default '';
alter table events.events add column if not exists image_paths    text[] not null default '{}';  -- [0] = cover
alter table events.events add column if not exists story_slug     text;   -- a /stories/ pair this item links to
alter table events.events add column if not exists recur_weekdays smallint[];  -- 0=Sun … 6=Sat; null = dated
alter table events.events add column if not exists recur_until    date;
-- set by the /app/events "translate to Arabic" button, cleared when a person
-- confirms the Arabic; a public row may never carry an unreviewed machine draft
alter table events.events add column if not exists ar_machine_translated boolean not null default false;

create unique index if not exists events_events_slug_uniq
  on events.events (slug) where slug is not null;

-- ---------------------------------------------------------------------
--  1b) The two rules, written once. publishable() is what "public" demands
--      of the text (the CHECK below and the demotion both call it);
--      next_occurrence() is the live rule (the feed and the /app/events list
--      both read it, so the admin's "on the site / ended" can't drift from
--      what the site shows). Plain-value arguments, not the row: anon reads
--      the feed with column-level grants only, and a whole-row reference
--      would need every column.
-- ---------------------------------------------------------------------
create or replace function events.publishable(
  slug text, title_he text, title_ar text, summary_he text, summary_ar text,
  body_he text, body_ar text, story_slug text)
returns boolean language sql immutable
set search_path = pg_catalog
as $$
  -- the body may be empty only when the item links a story pair (that pair is
  -- the detail page, and it ships HE + AR by ADR 0007)
  select slug is not null
     and btrim(title_he) <> ''   and btrim(title_ar) <> ''
     and btrim(summary_he) <> '' and btrim(summary_ar) <> ''
     and (story_slug is not null or (btrim(body_he) <> '' and btrim(body_ar) <> ''))
$$;

-- The next date an item happens on or after today (Jerusalem), or null once
-- it is over: a dated item until its date passes; a recurring one on its next
-- weekday, until recur_until.
create or replace function events.next_occurrence(
  event_date date, recur_weekdays smallint[], recur_until date)
returns date language sql stable
set search_path = pg_catalog
as $$
  with t as (select (now() at time zone 'Asia/Jerusalem')::date as today)
  select case
    when recur_weekdays is null then
      case when event_date >= t.today then event_date end
    else (
      select min(g::date)
      from generate_series(greatest(t.today, event_date),
                           greatest(t.today, event_date) + 6,
                           interval '1 day') g
      where extract(dow from g)::smallint = any (recur_weekdays)
        and (recur_until is null or g::date <= recur_until))
  end
  from t
$$;

-- PostgREST computed column for signed-in readers: `select=…,next_date` on
-- events.events (the /app/events list). Staff already read whole rows.
create or replace function events.next_date(e events.events)
returns date language sql stable
set search_path = pg_catalog
as $$ select events.next_occurrence(e.event_date, e.recur_weekdays, e.recur_until) $$;

revoke execute on function events.next_date(events.events) from public, anon;
grant  execute on function events.next_date(events.events) to authenticated;

-- ---------------------------------------------------------------------
--  2) Rows that cannot satisfy the new rules stop being public.
--     Before this file a public row needed nothing but a title, and no
--     public page read one. Such a row has no Arabic and no slug, so it
--     cannot be published under invariant 5; demoting it is the only state
--     the CHECKs below accept. Quote projections are always internal
--     already. Reported, not silent.
-- ---------------------------------------------------------------------
do $$
declare n int;
begin
  update events.events set visibility = 'internal'
  where visibility = 'public'
    and (not events.publishable(slug, title_he, title_ar, summary_he, summary_ar,
                                body_he, body_ar, story_slug)
         or source_module = 'quotes');
  get diagnostics n = row_count;
  if n > 0 then
    raise notice '58_events_public: % public event row(s) not publishable (missing a language or slug, or quote-sourced) demoted to internal', n;
  end if;
end $$;

-- ---------------------------------------------------------------------
--  3) Invariants (bilingual messages are mapped from the constraint names
--     in the /app/events UI; a CHECK is the gate, the form is convenience)
-- ---------------------------------------------------------------------
do $$ begin
  alter table events.events add constraint events_slug_format
    check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table events.events add constraint events_story_slug_format
    check (story_slug is null or story_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
exception when duplicate_object then null; end $$;

-- Every photo is <event id>/<name>.<ext> — the path the form writes; nothing a
-- page could turn into another URL. A CHECK cannot hold a subquery, hence the
-- immutable helper over the array.
create or replace function events.valid_image_paths(paths text[])
returns boolean language sql immutable
set search_path = pg_catalog
as $$
  select coalesce(bool_and(p ~ '^[0-9a-f-]{36}/[a-z0-9-]+\.(jpg|jpeg|png|webp)$'), true)
  from unnest(paths) as p
$$;

do $$ begin
  alter table events.events add constraint events_image_paths_valid
    check (cardinality(image_paths) <= 8 and events.valid_image_paths(image_paths));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table events.events add constraint events_recurrence_valid
    check ((recur_weekdays is null
            or (cardinality(recur_weekdays) between 1 and 7
                and recur_weekdays <@ array[0,1,2,3,4,5,6]::smallint[]))
           and (recur_until is null
                or (recur_weekdays is not null and recur_until >= event_date)));
exception when duplicate_object then null; end $$;

-- Public ⇒ both languages (invariant 5 in the DB) — the rule is publishable().
do $$ begin
  alter table events.events add constraint events_public_bilingual
    check (visibility <> 'public' or events.publishable(
      slug, title_he, title_ar, summary_he, summary_ar, body_he, body_ar, story_slug));
exception when duplicate_object then null; end $$;

-- Machine Arabic (Google returns Modern Standard, not the site's Levantine)
-- is a draft until a person confirms it — ADR 0055.
do $$ begin
  alter table events.events add constraint events_public_reviewed_arabic
    check (visibility <> 'public' or not ar_machine_translated);
exception when duplicate_object then null; end $$;

-- A quote-sourced event's title is a customer's name. The projector always
-- writes 'internal'; this makes it impossible for anything else to flip it.
-- (quotes is the only projector today. When a second one lands, the general
-- form is: module key = permission prefix, i.e. read needs
-- core.has_permission(source_module || '.view') — here and in the policy below.)
do $$ begin
  alter table events.events add constraint events_public_not_quote
    check (visibility <> 'public' or source_module is distinct from 'quotes');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
--  4) Quote-sourced rows (title = a customer's name) need quotes.view for
--     every client path — read, change, delete. 40's single FOR ALL write
--     policy is split: FOR ALL also grants SELECT, and permissive policies
--     are OR'd, so it would hand quote rows to any events.manage holder
--     without quotes.view (a custom "content editor" role, say).
-- ---------------------------------------------------------------------
drop policy if exists "events_events_select" on events.events;
create policy "events_events_select" on events.events for select to authenticated
  using ((select core.has_permission('events.view'))
         and (source_module is distinct from 'quotes'
              or (select core.has_permission('quotes.view'))));

drop policy if exists "events_events_write"  on events.events;
drop policy if exists "events_events_insert" on events.events;
drop policy if exists "events_events_update" on events.events;
drop policy if exists "events_events_delete" on events.events;
-- clients create direct events only; projections are the projector's job
-- (SECURITY DEFINER, owner — RLS does not apply to it)
create policy "events_events_insert" on events.events for insert to authenticated
  with check ((select core.has_permission('events.manage')) and source_module is null);
create policy "events_events_update" on events.events for update to authenticated
  using ((select core.has_permission('events.manage'))
         and (source_module is distinct from 'quotes'
              or (select core.has_permission('quotes.view'))))
  with check ((select core.has_permission('events.manage')));
create policy "events_events_delete" on events.events for delete to authenticated
  using ((select core.has_permission('events.manage'))
         and (source_module is distinct from 'quotes'
              or (select core.has_permission('quotes.view'))));

-- A row's source is the projecting module's to set, never a client's: without
-- this, an UPDATE could null source_module and slip a customer-named row past
-- events_public_not_quote. Projectors run as the table owner (SECURITY
-- DEFINER), so the guard only binds the API roles.
create or replace function events.guard_source()
returns trigger language plpgsql
set search_path = pg_catalog
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.source_module is distinct from old.source_module
          or new.source_id is distinct from old.source_id) then
    raise exception 'המקור של אירוע נקבע על ידי המודול שיצר אותו / مصدر الفعالية بيحدّده الموديول اللي عمله';
  end if;
  return new;
end $$;

drop trigger if exists events_events_guard_source on events.events;
create trigger events_events_guard_source
  before update on events.events
  for each row execute function events.guard_source();

-- ---------------------------------------------------------------------
--  5) The public feed — live items only, next occurrence computed
-- ---------------------------------------------------------------------
drop view if exists events.feed;
create view events.feed with (security_invoker = true) as
  select e.id, e.title, e.event_date, e.starts_at, e.ends_at, e.status,
         e.event_type, e.capacity,
         e.slug, e.title_he, e.title_ar, e.summary_he, e.summary_ar,
         e.body_he, e.body_ar, e.image_paths, e.story_slug,
         e.recur_weekdays, e.recur_until,
         n.next_date
  from events.events e
  cross join lateral (
    select events.next_occurrence(e.event_date, e.recur_weekdays, e.recur_until) as next_date
  ) n
  where e.visibility = 'public'
    and e.status in ('confirmed', 'in_progress')
    and n.next_date is not null;

-- Anon: column-level select on exactly the published fields (40 granted the
-- original set); notes / owner / source stay unreachable.
grant select (slug, title_he, title_ar, summary_he, summary_ar, body_he, body_ar,
              image_paths, story_slug, recur_weekdays, recur_until)
  on events.events to anon;
grant select on events.feed to authenticated, anon;

-- ---------------------------------------------------------------------
--  6) Storage — one public bucket for item photos (the galleries)
--     Public read goes through /storage/v1/object/public/ (no policy
--     needed); listing, upload, replace and delete need events.manage.
--     The private quotes-docs bucket keeps zero policies (50_storage.sql):
--     every policy here is scoped to bucket_id = 'events-public'.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('events-public', 'events-public', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "events_public_select" on storage.objects;
drop policy if exists "events_public_insert" on storage.objects;
drop policy if exists "events_public_update" on storage.objects;
drop policy if exists "events_public_delete" on storage.objects;

create policy "events_public_select" on storage.objects for select to authenticated
  using (bucket_id = 'events-public' and (select core.has_permission('events.manage')));
create policy "events_public_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'events-public' and (select core.has_permission('events.manage')));
create policy "events_public_update" on storage.objects for update to authenticated
  using (bucket_id = 'events-public' and (select core.has_permission('events.manage')))
  with check (bucket_id = 'events-public' and (select core.has_permission('events.manage')));
create policy "events_public_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'events-public' and (select core.has_permission('events.manage')));

-- ---------------------------------------------------------------------
--  7) The module goes live (40 seeded it disabled until this UI existed)
-- ---------------------------------------------------------------------
-- Only from 40's seeded state (disabled, original label) — a re-run must not
-- undo a rename, nor switch the module back on after the owner turned it off.
update core.modules set enabled = true, label = 'מה קורה'
where key = 'events' and not enabled and label = 'יומן ואירועים';
