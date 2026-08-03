-- =====================================================================
--  56_finance_override.sql — the owner's last word (PR C of the finance
--  books-integrity initiative).
--
--  Or's brief: "ability to override everything by the owner". Today the
--  opposite is true — finance.entries_guard() blocks every client edit and
--  delete of a row carrying provenance, for everyone including the owner, and
--  that guard is a deliberate architecture invariant (ARCHITECTURE.md §7.4).
--  When reality and a module disagree (a cash count that will not match, a POS
--  day that cannot be recomputed correctly), there is currently no way out.
--
--  This file gives the owner the last word WITHOUT weakening the invariant:
--  the correction is ADDITIVE. The original posting is never touched, never
--  hidden, and stays exactly as the module wrote it; a second row carrying
--  source_module = 'override' moves the total to whatever the owner says. Both
--  rows are visible in the ledger, so the books explain themselves.
--
--  The delta is computed HERE, from what the books actually hold, never sent
--  by the client — same stance as pos.post_day(). The owner states the correct
--  TOTAL; the server works out what to add.
--
--  Pinning is SEPARATE and deliberate (pos.day_pins, 48). The plan expected a
--  correction to imply a pin; testing showed it must not — an additive
--  correction is already immune to the auto re-post, while a pin freezes the
--  whole day and would swallow every cost entered afterwards. See §4 below.
--
--  Re-runnable; apply after 55. Plan: docs/plans/finance-books-integrity.md
-- =====================================================================

-- ---------------------------------------------------------------------
--  1) The override source_ref grammar: 'override:<target>:c<n>'
--
--     <target> is what is being corrected, and is itself one of:
--       'pos:<date>:<leg>'  — a POS day leg (the SAME string pos.post_day
--                             writes, so the two agree by construction)
--       'entry:<uuid>'      — any other single entry
--
--     <n> makes repeat corrections distinct, which the posting unique index
--     on (source_module, source_ref, kind, category) requires — the same
--     device post_day uses for its ':r<n>' corrections.
--
--     The reader below is the counterpart to that format, declared next to
--     it: correcting a correction must resolve back to the ORIGINAL target,
--     never nest. <target> contains colons of its own, so this strips the
--     wrapper rather than splitting on ':'.
-- ---------------------------------------------------------------------
create or replace function finance.override_ref_target(p_ref text)
returns text language sql immutable as $$
  select regexp_replace(regexp_replace(p_ref, '^override:', ''), ':c[0-9]+$', '');
$$;
-- Pure string function over the caller's own argument — revoked to match the
-- standing rule for this initiative rather than because it leaks anything.
revoke all on function finance.override_ref_target(text) from public;

-- ---------------------------------------------------------------------
--  2) What does correcting THIS entry actually mean?
--
--     Resolves the row the owner clicked to its correction target, and to the
--     total the books currently hold for that target — which is emphatically
--     not "the amount on that row":
--
--       * a POS leg is the sum of its original posting, every ':r<n>'
--         auto-correction the re-post has written since, and every override
--         already applied to it. Correcting only the one row the owner
--         happened to click would be undone by the next re-post.
--       * a correction row resolves to whatever IT corrects, so a second
--         override adjusts the same target instead of stacking a new one.
--
--     INTERNAL: security definer, no permission check, revoked from every
--     client — the two callers below gate themselves. It reads the whole
--     ledger to total a target, so it must never be client-callable.
-- ---------------------------------------------------------------------
create or replace function finance.correction_target(p_entry uuid)
returns table (target text, kind text, category text, entry_date date,
               event_id uuid, current_total numeric, pos_date date)
language plpgsql stable security definer set search_path = finance, pos, core as $$
declare
  e        finance.entries%rowtype;
  anchor   finance.entries%rowtype;
  v_target text;
  v_pos    date;
begin
  select * into e from finance.entries where id = p_entry;
  if not found then
    raise exception 'לא נמצאה תנועה לתיקון';
  end if;

  if e.source_module = 'override' then
    v_target := finance.override_ref_target(e.source_ref);
  elsif e.source_module = 'pos'
        and e.source_ref like pos.day_ref_prefix(e.entry_date) || '%' then
    v_target := pos.day_ref_prefix(e.entry_date) || pos.day_ref_leg(e.source_ref);
  else
    v_target := 'entry:' || e.id;
  end if;

  -- The anchor supplies kind/category/date/event: a correction must land in the
  -- same bucket and the same reporting period as the number it corrects, or the
  -- original month stays wrong and only the lifetime total comes out right.
  if v_target like 'entry:%' then
    select * into anchor from finance.entries
    where id = substring(v_target from 7)::uuid;
  else
    v_pos := split_part(v_target, ':', 2)::date;
    select * into anchor from finance.entries
    where source_module = 'pos' and source_ref = v_target;
  end if;
  if not found then
    raise exception 'לא נמצאה התנועה המקורית (%) לתיקון', v_target;
  end if;

  return query
  select v_target, anchor.kind, anchor.category, anchor.entry_date, anchor.event_id,
         coalesce((
           select sum(x.amount) from finance.entries x
           where -- the target's own postings: one row for an entry target, the
                 -- whole leg incl. ':r<n>' re-post corrections for a POS target
                 (v_target like 'entry:%' and x.id = anchor.id)
              or (v_target not like 'entry:%' and x.source_module = 'pos'
                  and (x.source_ref = v_target or x.source_ref like v_target || ':r%'))
              -- plus every override already applied to it
              or (x.source_module = 'override'
                  and x.source_ref like 'override:' || v_target || ':c%')
         ), 0),
         v_pos;
end; $$;

revoke all on function finance.correction_target(uuid) from public;

-- ---------------------------------------------------------------------
--  3) Preview — what the correction form needs before the owner types.
--     The client must not compute the current total itself: for a POS leg it
--     is spread over rows the ledger page has not necessarily loaded.
-- ---------------------------------------------------------------------
create or replace function finance.correction_preview(p_entry uuid)
returns jsonb language plpgsql stable security definer
set search_path = finance, pos, core as $$
declare t record;
begin
  if not core.has_permission('finance.override') then
    raise exception 'permission denied';
  end if;
  select * into t from finance.correction_target(p_entry);
  return jsonb_build_object(
    'target', t.target, 'kind', t.kind, 'category', t.category,
    'entry_date', t.entry_date, 'current_total', t.current_total,
    -- so the form can warn that saving will also freeze the day
    'pos_date', t.pos_date,
    'pos_pinned', t.pos_date is not null and pos.day_is_pinned(t.pos_date));
end; $$;

-- ---------------------------------------------------------------------
--  4) Post the correction.
--
--     SECURITY DEFINER by necessity: it writes a row carrying provenance, so
--     it must set the posting GUC that finance.entries_guard() checks. It
--     therefore gates on finance.override on entry, and the PUBLIC execute
--     grant is revoked explicitly below — revoking from `authenticated` alone
--     leaves PUBLIC in place, the escalation shape this repo has shipped twice.
-- ---------------------------------------------------------------------
create or replace function finance.post_correction(
  p_entry  uuid,
  p_amount numeric,        -- the CORRECT TOTAL for the target, not a delta
  p_reason text
) returns jsonb
language plpgsql security definer set search_path = finance, pos, core as $$
declare
  t        record;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_delta  numeric;
  v_n      int;
  v_ref    text;
  v_entry  uuid;
begin
  if not core.has_permission('finance.override') then
    raise exception 'permission denied';
  end if;
  -- An override with no stated reason is an unauditable number. The whole
  -- justification for allowing it at all is that it stays explainable.
  if v_reason = '' then
    raise exception 'תיקון חייב לכלול סיבה';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'סכום התיקון חייב להיות אפס או יותר';
  end if;

  select * into t from finance.correction_target(p_entry);

  v_delta := p_amount - t.current_total;
  if v_delta = 0 then
    raise exception 'הסכום כבר %, אין מה לתקן', t.current_total;
  end if;

  select count(*) into v_n from finance.entries
  where source_module = 'override'
    and source_ref like 'override:' || t.target || ':c%';
  v_ref := 'override:' || t.target || ':c' || (v_n + 1);

  perform set_config('levyam.finance_posting', 'on', true);
  insert into finance.entries
    (kind, category, amount, payment_method, entry_date, note, source_module, source_ref, event_id)
  values (
    t.kind, t.category, v_delta,
    null,                 -- a correction moves the books, not a drawer
    t.entry_date,         -- same period as the number it corrects
    'תיקון בעלים: ' || v_reason,
    'override', v_ref, t.event_id
  )
  returning id into v_entry;
  perform set_config('levyam.finance_posting', '', true);

  -- NO automatic pin. The plan specified one here, on the premise that the
  -- auto re-post would otherwise overwrite the correction — that premise is
  -- false for an ADDITIVE correction, and the difference was measured, not
  -- assumed (see the deviation note in the plan's §3):
  --
  --   pos.post_day() computes a leg's current value from `source_module = 'pos'`
  --   rows only. An override row is invisible to it, so re-posting writes the
  --   pos-side delta and leaves the correction standing. A day corrected to 150,
  --   then given another ₪100 of takings, re-posts to 300 pos + (−50) = 250 —
  --   which is the right answer: the correction records a known discrepancy,
  --   not a permanent ceiling.
  --
  -- Auto-pinning would have been strictly harmful: a pin freezes the WHOLE day,
  -- so every food cost, labour cost and late payment entered afterwards would
  -- silently never reach the books. Pinning stays an explicit owner action for
  -- when freezing is the actual intent (a closed period, a disputed day).

  return jsonb_build_object(
    'entry_id', v_entry, 'target', t.target,
    'previous_total', t.current_total, 'new_total', p_amount, 'delta', v_delta,
    'pos_date', t.pos_date);
end; $$;

revoke all on function finance.correction_preview(uuid)            from public;
revoke all on function finance.post_correction(uuid, numeric, text) from public;
grant execute on function finance.correction_preview(uuid)            to authenticated;
grant execute on function finance.post_correction(uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------
--  SEED DATA — permission (idempotent)
--  Owner-only. This is the one key that can move a module-posted number, and
--  the pin it implies stops POS from ever recomputing that day again.
-- ---------------------------------------------------------------------
insert into core.permissions (key, module, action, label) values
  ('finance.override', 'finance', 'override', 'תיקון בעלים ונעילת ימים')
on conflict (key) do nothing;

insert into core.role_permissions (role_id, permission_id)
select r.id, p.id from core.roles r, core.permissions p
where r.key = 'owner' and p.key = 'finance.override'
on conflict do nothing;
