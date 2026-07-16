-- =====================================================================
--  Lev Yam platform — STORAGE posture (repo source of truth, H7 2026-07-15)
--  Idempotent; safe to re-run in the Supabase SQL editor.
--
--  One private bucket: quotes-docs — the immutable PDF/HTML snapshots of
--  signed contracts imported from the legacy quotes app (legal records).
--
--  Verified on prod 2026-07-15: storage.objects has RLS enabled and ZERO
--  policies — deliberately. No client (anon or authenticated, any role)
--  can list, read, or write objects; only service_role (dashboard, Edge
--  Functions) reaches them. That is the strictest possible posture for
--  legal documents (ARCHITECTURE.md §2 "sensitive artifacts get the
--  strictest storage") and it is the INTENDED state — this file exists so
--  the posture is versioned here instead of implied by dashboard state.
--
--  If the quotes module ever needs in-app access to these files, add a
--  narrow select policy gated by (select core.has_permission('quotes.contracts'))
--  HERE (and extend supabase/tests/rls_matrix.sql) — never via the dashboard.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('quotes-docs', 'quotes-docs', false)
on conflict (id) do update set public = false;

-- No storage.objects policies — intentionally none (see header).
