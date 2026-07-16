import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, core, isConfigured } from './supabase'
import type { RoleRow } from '../types'

// one source of truth for the core.roles row shape — this is just the slice
// the roles!inner embed selects
export type MyRole = Omit<RoleRow, 'id'>

interface AuthState {
  loading: boolean
  configured: boolean
  session: Session | null
  user: User | null
  /** Permission keys the signed-in user holds (from core.my_permissions()). */
  permissions: string[]
  /** The signed-in user's roles, lowest sort first (own core.user_roles rows).
   *  Refreshed together with the permission mirror. */
  roles: MyRole[]
  /** UI-side mirror of the RLS check — convenience only, the DB still enforces. */
  has: (perm: string) => boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshPermissions: () => Promise<void>
  resetPasswordForEmail: (email: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [roles, setRoles] = useState<MyRole[]>([])
  // mirrors `session` for the focus listener below, which must not re-subscribe
  // on every auth change just to see the latest value
  const sessionRef = useRef<Session | null>(null)

  async function loadPermissions(active: Session | null) {
    if (!active) {
      setPermissions([])
      setRoles([])
      return
    }
    const [permsRes, rolesRes] = await Promise.all([
      core().rpc('my_permissions'),
      // !inner: the FK guarantees a match, so `roles` comes back non-null
      core().from('user_roles').select('roles!inner(key, label, sort)').eq('user_id', active.user.id),
    ])
    if (permsRes.error) {
      console.error('Failed to load permissions:', permsRes.error.message)
      setPermissions([])
    } else {
      setPermissions((permsRes.data as string[] | null) ?? [])
    }
    if (rolesRes.error) {
      console.error('Failed to load roles:', rolesRes.error.message)
      setRoles([])
    } else {
      const rs = ((rolesRes.data ?? []) as unknown as { roles: MyRole }[]).map((r) => r.roles)
      setRoles(rs.sort((a, b) => a.sort - b.sort))
    }
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      sessionRef.current = data.session
      setSession(data.session)
      await loadPermissions(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return
      sessionRef.current = next
      setSession(next)
      // Defer the RPC out of the auth callback: supabase-js holds the GoTrue lock
      // while this runs, and calling .rpc() (which fetches the access token) inside
      // it can deadlock. setTimeout(0) lets the lock release first.
      setTimeout(() => {
        if (mounted) void loadPermissions(next)
      }, 0)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    // A permission change (e.g. someone else edits your role) is enforced by the
    // DB instantly, but the UI mirror only reloaded on page refresh — pick it up
    // when the tab regains focus too. Reads the ref (not `session`) so this
    // effect registers once instead of re-subscribing on every auth change.
    function onFocus() {
      void loadPermissions(sessionRef.current)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const value: AuthState = {
    loading,
    configured: isConfigured,
    session,
    user: session?.user ?? null,
    permissions,
    roles,
    has: (perm) => permissions.includes(perm),
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error: error?.message ?? null }
    },
    signOut: async () => {
      await supabase.auth.signOut()
    },
    refreshPermissions: () => loadPermissions(session),
    resetPasswordForEmail: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/app/reset-password`,
      })
      return { error: error?.message ?? null }
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
