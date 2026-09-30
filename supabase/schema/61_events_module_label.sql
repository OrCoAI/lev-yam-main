-- =====================================================================
--  Lev Yam platform — the staff module is named "יוזמות" too
--  (owner, 2026-09-30; ADR 0060, amending 0058, which had kept "מה קורה"
--  for the app). Run AFTER 58_events_public.sql. Idempotent; safe to re-run.
--  A data change on an existing row: hand-apply it on staging and prod
--  (the grant audit cannot see it) and check the label afterwards.
--
--  The launcher tile reads core.modules.label (one label, shown in both
--  languages — bilingual module labels are a tracked follow-up in
--  app-src/src/lib/i18n.tsx). The page heading is the module dictionary
--  (app-src/src/modules/events/i18n.ts), changed in the same commit.
--
--  Only from 58's label: a later rename by the owner is never undone.
-- =====================================================================

update core.modules set label = 'יוזמות'
where key = 'events' and label = 'מה קורה';
