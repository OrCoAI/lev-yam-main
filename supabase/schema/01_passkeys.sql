-- =====================================================================
--  Lev Yam platform — PASSKEYS (WebAuthn / Face ID) for core auth
--  Run AFTER 00_core.sql, in the Supabase SQL editor.
--
--  Two tables in `core`:
--    core.passkeys             stored WebAuthn credentials (public keys)
--    core.webauthn_challenges  short-lived register/login challenges
--
--  Writes happen ONLY from the `passkey-verify` Edge Function (service role,
--  bypasses RLS). Clients may read/delete their OWN passkeys; challenges are
--  never client-accessible.
-- =====================================================================

create table if not exists core.passkeys (
  id           text primary key,                       -- credential ID (base64url)
  user_id      uuid not null references auth.users(id) on delete cascade,
  public_key   text not null,                          -- COSE public key (base64url)
  counter      bigint not null default 0,
  transports   text[],
  label        text,                                   -- device label, e.g. 'MacBook'
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists passkeys_user_id_idx on core.passkeys (user_id);

create table if not exists core.webauthn_challenges (
  id         uuid primary key default gen_random_uuid(),
  challenge  text not null,
  user_id    uuid references auth.users(id) on delete cascade,  -- set for 'register'
  kind       text not null check (kind in ('register', 'login')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes')
);

-- ---------------------------------------------------------------------
--  RLS
-- ---------------------------------------------------------------------
alter table core.passkeys            enable row level security;
alter table core.webauthn_challenges enable row level security;

-- passkeys: a user sees & removes only their own. Inserts/updates come from the
-- Edge Function (service role) — no write policy is granted to clients.
-- (select auth.uid()) rather than bare auth.uid(): the planner evaluates it once
-- per statement (InitPlan) instead of per row — see MODULE-TEMPLATE.md §1.
drop policy if exists passkeys_read_own   on core.passkeys;
drop policy if exists passkeys_delete_own on core.passkeys;
create policy passkeys_read_own   on core.passkeys for select to authenticated
  using (user_id = (select auth.uid()));
create policy passkeys_delete_own on core.passkeys for delete to authenticated
  using (user_id = (select auth.uid()));

-- challenges: RLS on, ZERO policies => no client (anon/authenticated) access at all.
-- Only the service role (Edge Function) touches this table.

-- Clients may read/delete their own passkeys; challenges get nothing.
grant select, delete on core.passkeys to authenticated;
-- (intentionally NO grant on core.webauthn_challenges for clients)

-- The passkey-verify Edge Function runs as service_role. BYPASSRLS skips policies
-- but NOT table grants, and a custom schema isn't auto-granted — so grant explicitly.
grant usage on schema core to service_role;
grant select, insert, update, delete on core.passkeys, core.webauthn_challenges to service_role;

-- ---------------------------------------------------------------------
--  Housekeeping: drop expired challenges. Call opportunistically from the
--  Edge Function, or schedule via pg_cron if available.
-- ---------------------------------------------------------------------
create or replace function core.purge_expired_challenges()
returns void
language sql security definer
set search_path = core, public
as $$
  delete from core.webauthn_challenges where expires_at < now();
$$;
grant execute on function core.purge_expired_challenges() to service_role;
