import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** False when the .env values are missing — the login screen shows a setup hint instead of failing silently. */
export const isConfigured = Boolean(url && anonKey)

// The anon/publishable key is safe in the client; Row-Level Security + Auth are the real guard.
export const supabase = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'anon-placeholder',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
)

/** PostgREST client scoped to the shared `core` schema (roles, permissions, RPCs). */
export const core = () => supabase.schema('core')

/** PostgREST client scoped to the finance module's schema (entries, report RPC). */
export const finance = () => supabase.schema('finance')
