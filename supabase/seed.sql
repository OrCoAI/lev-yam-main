-- =====================================================================
--  Local / staging SEED — synthetic data only. NEVER real customer data.
--  Applied by `supabase db reset` after the migrations (config: [db.seed]).
--
--  Creates three login users (one per working role) + a little finance data
--  so the app isn't empty. All fake. Passwords are dev-only.
--
--    owner@levyam.local    / levyamdev   (role: owner)
--    manager@levyam.local  / levyamdev   (role: manager)
--    staff@levyam.local    / levyamdev   (role: staff)
--
--  Passkeys are origin-bound and can't be enrolled on localhost — use the
--  email+password above locally; passkeys get tested on staging.levyam.com.
-- =====================================================================

-- ── auth users (email + password) ───────────────────────────────────
-- Fixed UUIDs so the seed is idempotent and role/data rows can reference them.
-- pgcrypto lives in the `extensions` schema — qualify crypt/gen_salt explicitly.
-- GoTrue's Go scanner rejects NULL for its token columns (confirmation_token,
-- recovery_token, email_change*, …) — they must be '' or login 500s with
-- "converting NULL to string is unsupported". Set them explicitly.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000', v.id, 'authenticated', 'authenticated',
  v.email, extensions.crypt('levyamdev', extensions.gen_salt('bf')),
  now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}',
  '', '', '', '', '', '', '', ''
from (values
  ('00000000-0000-0000-0000-000000000001'::uuid, 'owner@levyam.local'),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'manager@levyam.local'),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'staff@levyam.local')
) as v(id, email)
on conflict (id) do nothing;

-- ── auth identities (required for email/password sign-in) ────────────
insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', u.id::text, now(), now(), now()
from auth.users u
where u.email in ('owner@levyam.local', 'manager@levyam.local', 'staff@levyam.local')
on conflict (provider, provider_id) do nothing;

-- ── role assignments (the owner-bootstrap snippet from 00_core, seeded) ─
insert into core.user_roles (user_id, role_id)
select u.id, r.id
from (values
  ('owner@levyam.local',   'owner'),
  ('manager@levyam.local', 'manager'),
  ('staff@levyam.local',   'staff')
) as m(email, role_key)
join auth.users u on u.email = m.email
join core.roles r on r.key  = m.role_key
on conflict do nothing;

-- ── a little synthetic finance data (manual-entry categories only) ──
-- Fixed ids → idempotent. Uses manual-allowed categories (the spine blocks the
-- derived ones: events / pos / pos_food / pos_labor); created_by = the owner.
insert into finance.entries (id, kind, category, amount, payment_method, entry_date, note, created_by)
values
  ('00000000-0000-0000-0000-0000000f0001', 'income',  'bookings',  1500.00, 'cash', current_date - 3, 'Seed: Friday dinner party (fake)',  '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000f0002', 'expense', 'marketing',  320.00, 'bank', current_date - 5, 'Seed: printed flyers (fake)',       '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000f0003', 'expense', 'suppliers',  880.50, 'cash', current_date - 2, 'Seed: fish + produce (fake)',       '00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;
