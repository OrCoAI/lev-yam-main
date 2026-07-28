-- ---------------------------------------------------------------------
--  49_pos_kitchen.sql — kitchen "mark ready" becomes per-unit
--
--  Owner request (2026-07-28): when a line has several units in the kitchen,
--  each "מוכן ✓" tap should mark ONE unit ready, not clear the whole line.
--  So pos_mark_item moves `done` by a single unit instead of jumping it to
--  `sent` (ready) / `served` (undo). Signature is unchanged (text, text, bool)
--  — p_ready=true advances one unit, p_ready=false steps one back — so no
--  client arity change. Read-modify-write stays server-side and clamped
--  (served ≤ done ≤ sent) so it can't clobber a waiter editing the same table
--  or drift out of the qty→sent→done→served pipeline.
--
--  Plan: docs/plans/pos-menu-kitchen.md (PR 1). Supersedes the whole-line
--  version in 43_pos_cutover.sql.
-- ---------------------------------------------------------------------
create or replace function pos.pos_mark_item(p_id text, p_item_id text, p_ready boolean)
returns void language plpgsql security definer set search_path = pos, public as $$
begin
  perform pos.require('pos.kitchen');
  update pos.pos_tables t
  set items = coalesce((
        select jsonb_agg(
          case when e->>'id' = p_item_id
               then e || jsonb_build_object('done',
                      case
                        -- one more unit ready, never past what's been sent
                        when p_ready then least(coalesce((e->>'sent')::int, 0),
                                                coalesce((e->>'done')::int, 0) + 1)
                        -- one unit back, never below what's already been served (carried out)
                        else greatest(coalesce((e->>'served')::int, 0),
                                      coalesce((e->>'done')::int, 0) - 1)
                      end)
               else e end)
        from jsonb_array_elements(t.items) e), '[]'::jsonb),
      updated_at = now()
  where t.id = p_id;
end; $$;
