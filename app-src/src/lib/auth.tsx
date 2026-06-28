import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, core, isConfigured } from './supabase'

interface AuthState {
  loading: boolean
  configured: boolean
  session: Session | null
  user: User | null
  /** Permission keys the signed-in user holds (from core.my_permissions()). */
  permissions: string[]
  /** UI-side mirror of the RLS check — convenience only, the DB still enforces. */
  has: (perm: string) => boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshPermissions: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])

  async function loadPermissions(active: Session | null) {
    if (!active) {
      setPermissions([])
      return
    }
    const { data, error } = await core().rpc('my_permissions')
    if (error) {
      console.error('Failed to load permissions:', error.message)
      setPermissions([])
      return
    }
    setPermissions((data as string[] | null) ?? [])
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      await loadPermissions(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return
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

  const value: AuthState = {
    loading,
    configured: isConfigured,
    session,
    user: session?.user ?? null,
    permissions,
    has: (perm) => permissions.includes(perm),
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error: error?.message ?? null }
    },
    signOut: async () => {
      await supabase.auth.signOut()
    },
    refreshPermissions: () => loadPermissions(session),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
