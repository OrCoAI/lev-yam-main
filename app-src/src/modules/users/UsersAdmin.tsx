import { useEffect, useState, useCallback } from 'react'
import { core } from '../../lib/supabase'
import { useCan, PERM } from '../../lib/permissions'
import type { AdminUser, RoleRow, PermissionRow, RolePermissionRow } from '../../types'

type Tab = 'users' | 'matrix'

export default function UsersAdmin() {
  const canManage = useCan(PERM.usersManage)
  const [tab, setTab] = useState<Tab>('users')

  return (
    <section>
      <h1 className="page-title">ניהול משתמשים והרשאות</h1>
      {!canManage && (
        <p className="notice">תצוגה בלבד — אין לך הרשאת ניהול ({PERM.usersManage}).</p>
      )}

      <div className="tabs">
        <button className={tab === 'users' ? 'tab on' : 'tab'} onClick={() => setTab('users')}>
          משתמשים
        </button>
        <button className={tab === 'matrix' ? 'tab on' : 'tab'} onClick={() => setTab('matrix')}>
          תפקידים והרשאות
        </button>
      </div>

      {tab === 'users' ? <UsersTab canManage={canManage} /> : <MatrixTab canManage={canManage} />}
    </section>
  )
}

/* ------------------------------------------------------------------ Users tab */

function UsersTab({ canManage }: { canManage: boolean }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [usersRes, rolesRes] = await Promise.all([
      core().rpc('admin_list_users'),
      core().from('roles').select('*').order('sort'),
    ])
    if (usersRes.error) setError(usersRes.error.message)
    else if (rolesRes.error) setError(rolesRes.error.message)
    else {
      setUsers((usersRes.data as AdminUser[] | null) ?? [])
      setRoles((rolesRes.data as RoleRow[] | null) ?? [])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function toggleRole(user: AdminUser, role: RoleRow, assigned: boolean) {
    setBusy(user.user_id + role.id)
    const table = core().from('user_roles')
    const res = assigned
      ? await table.delete().eq('user_id', user.user_id).eq('role_id', role.id)
      : await table.insert({ user_id: user.user_id, role_id: role.id })
    setBusy(null)
    if (res.error) setError(res.error.message)
    else await load()
  }

  if (loading) return <div className="muted">טוען משתמשים…</div>
  if (error) return <div className="error">שגיאה: {error}</div>

  return (
    <div className="card">
      <table className="grid grid-sticky-first">
        <thead>
          <tr>
            <th>משתמש</th>
            {roles.map((r) => (
              <th key={r.id} className="center">
                {r.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.user_id}>
              <td>{u.email ?? u.user_id}</td>
              {roles.map((r) => {
                const assigned = u.roles.includes(r.key)
                return (
                  <td key={r.id} className="center">
                    <input
                      type="checkbox"
                      checked={assigned}
                      disabled={!canManage || busy === u.user_id + r.id}
                      onChange={() => toggleRole(u, r, assigned)}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={roles.length + 1} className="muted">
                אין משתמשים. צרו משתמש ב-Supabase → Authentication.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------- Roles × Permissions matrix */

function MatrixTab({ canManage }: { canManage: boolean }) {
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [perms, setPerms] = useState<PermissionRow[]>([])
  const [grants, setGrants] = useState<Set<string>>(new Set()) // `${role_id}:${permission_id}`
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [rolesRes, permsRes, rpRes] = await Promise.all([
      core().from('roles').select('*').order('sort'),
      core().from('permissions').select('*').order('module').order('action'),
      core().from('role_permissions').select('*'),
    ])
    const firstError = rolesRes.error || permsRes.error || rpRes.error
    if (firstError) {
      setError(firstError.message)
    } else {
      setRoles((rolesRes.data as RoleRow[] | null) ?? [])
      setPerms((permsRes.data as PermissionRow[] | null) ?? [])
      setGrants(
        new Set(
          ((rpRes.data as RolePermissionRow[] | null) ?? []).map(
            (g) => `${g.role_id}:${g.permission_id}`,
          ),
        ),
      )
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function toggle(role: RoleRow, perm: PermissionRow) {
    const key = `${role.id}:${perm.id}`
    const granted = grants.has(key)
    setBusy(key)
    const table = core().from('role_permissions')
    const res = granted
      ? await table.delete().eq('role_id', role.id).eq('permission_id', perm.id)
      : await table.insert({ role_id: role.id, permission_id: perm.id })
    setBusy(null)
    if (res.error) {
      setError(res.error.message)
      return
    }
    // optimistic local update (avoids a full reload per click)
    setGrants((prev) => {
      const next = new Set(prev)
      if (granted) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (loading) return <div className="muted">טוען הרשאות…</div>
  if (error) return <div className="error">שגיאה: {error}</div>

  return (
    <div className="card">
      <table className="grid grid-sticky-first">
        <thead>
          <tr>
            <th>הרשאה</th>
            {roles.map((r) => (
              <th key={r.id} className="center">
                {r.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {perms.map((p) => (
            <tr key={p.id}>
              <td>
                <code className="perm-key">{p.key}</code>
                <span className="perm-label">{p.label}</span>
              </td>
              {roles.map((r) => {
                const key = `${r.id}:${p.id}`
                return (
                  <td key={r.id} className="center">
                    <input
                      type="checkbox"
                      checked={grants.has(key)}
                      disabled={!canManage || busy === key}
                      onChange={() => toggle(r, p)}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
