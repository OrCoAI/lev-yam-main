import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, core, isConfigured } from './supabase'
import type { RoleRow } from '../types'

// one source of truth for the core.roles row shape — this is just the slice
// the roles!inner embed selects
export type MyRole = Omit<RoleRow, 'id'>

/** View-as permission preview (users module): the UI mirror renders with the
 *  target user's effective permission set. STRICTLY a mirror swap — every data
 *  read still runs under the admin's own session and RLS; nothing is
 *  impersonated server-side (plan decision 2026-07-15: preview, not
 *  impersonation). Session-local: a reload exits. */
interface PreviewState {
  email: string
  permissions: string[]
}

interface AuthState {
  loading: boolean
  configured: boolean
  session: Session | null
  user: User | null
  /** Permission keys the signed-in user REALLY holds (from core.my_permissions()).
   *  Not affected by preview — gate UI through has(), not this list. */
  permissions: string[]
  /** The signed-in user's roles, lowest sort first (own core.user_roles rows).
   *  Refreshed together with the permission mirror. */
  roles: MyRole[]
  /** UI-side mirror of the RLS check — convenience only, the DB still enforces.
   *  While a preview is active, answers for the PREVIEWED user's set. */
  has: (perm: string) => boolean
  preview: PreviewState | null
  /** Starts a view-as preview; returns false (and does nothing) unless the
   *  caller really holds users.manage — callers must not navigate on false. */
  startPreview: (email: string, permissions: string[]) => boolean
  stopPreview: () => void
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
  const [preview, setPreview] = useState<PreviewState | null>(null)
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
      // a different (or ended) IDENTITY must never inherit a preview — but a
      // routine TOKEN_REFRESHED for the same user must not kick the admin out
      // of one either
      if (next?.user?.id !== sessionRef.current?.user?.id) setPreview(null)
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
    // Preview answers with the INTERSECTION of the target's set and the real
    // one: requests still run under the real session, so rendering a control
    // the target holds but the admin doesn't would invite server-rejected
    // clicks (custom admin roles make target ⊆ admin non-guaranteed). For the
    // typical owner-previews-staff case the intersection equals the target set.
    has: (perm) =>
      permissions.includes(perm) && (!preview || preview.permissions.includes(perm)),
    preview,
    startPreview: (email, previewPermissions) => {
      // UI guard only (the DB never sees preview state): still, don't let a
      // stale users-module render start a preview the caller can't legitimately
      // use. Literal instead of PERM.usersManage — permissions.ts imports this
      // file, and the constant isn't worth the import cycle.
      if (!permissions.includes('users.manage')) return false
      setPreview({ email, permissions: previewPermissions })
      return true
    },
    stopPreview: () => setPreview(null),
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
