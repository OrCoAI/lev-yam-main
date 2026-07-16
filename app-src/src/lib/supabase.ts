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

/** Call an Edge Function and throw on either a transport error or a `{ error }` payload. */
export async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    // Non-2xx: supabase-js hides the function's response behind a generic
    // FunctionsHttpError message, keeping the raw Response in error.context —
    // recover the function's own { error: <code> } body so callers can map
    // codes ('forbidden', 'last_admin', …) to bilingual strings.
    const ctx = (error as { context?: unknown }).context
    if (ctx instanceof Response) {
      const payload = await ctx.clone().json().catch(() => null)
      if (payload?.error) throw new Error(payload.error)
    }
    throw new Error(error.message)
  }
  if (data?.error) throw new Error(data.error)
  return data as T
}

/** PostgREST client scoped to the finance module's schema (entries, report RPC). */
export const finance = () => supabase.schema('finance')

/** PostgREST client scoped to the quotes module's schema (quotes, contracts, settings). */
export const quotes = () => supabase.schema('quotes')

/** The pos schema — platform-side functions (close_day). The live pos_* tables stay in public until cut-over. */
export const pos = () => supabase.schema('pos')
