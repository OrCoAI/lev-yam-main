import { Fragment, useEffect, useState, useCallback, type FormEvent } from 'react'
import { core, invokeFunction } from '../../lib/supabase'
import { useCan, PERM } from '../../lib/permissions'
import type { AdminUser, RoleRow, PermissionRow, RolePermissionRow } from '../../types'
import { useUT } from './i18n'
import './users.css'

type Tab = 'users' | 'matrix'

function ErrorNotice({ error }: { error: string }) {
  const ut = useUT()
  return (
    <div className="error">
      {ut.errorPrefix} {error}
    </div>
  )
}

export default function UsersAdmin() {
  const ut = useUT()
  const canManage = useCan(PERM.usersManage)
  const [tab, setTab] = useState<Tab>('users')

  return (
    <section>
      <h1 className="page-title">{ut.title}</h1>
      {!canManage && (
        <p className="notice">
          {ut.viewOnly} ({PERM.usersManage}).
        </p>
      )}

      <div className="tabs">
        <button className={tab === 'users' ? 'tab on' : 'tab'} onClick={() => setTab('users')}>
          {ut.tabUsers}
        </button>
        <button className={tab === 'matrix' ? 'tab on' : 'tab'} onClick={() => setTab('matrix')}>
          {ut.tabMatrix}
        </button>
      </div>

      {tab === 'users' ? <UsersTab canManage={canManage} /> : <MatrixTab canManage={canManage} />}
    </section>
  )
}

/* ------------------------------------------------------------------ Users tab */

function UsersTab({ canManage }: { canManage: boolean }) {
  const ut = useUT()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [error, setError] = useState<string | null>(null)
  // a failed role toggle (e.g. the last-admin guard rejecting it) shows inline
  // — unlike `error` above, it must not blank out an already-loaded list
  const [actionError, setActionError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

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
    setActionError(null)
    const table = core().from('user_roles')
    const res = assigned
      ? await table.delete().eq('user_id', user.user_id).eq('role_id', role.id)
      : await table.insert({ user_id: user.user_id, role_id: role.id })
    setBusy(null)
    if (res.error) setActionError(res.error.message)
    else await load()
  }

  if (loading) return <div className="muted">{ut.loadingUsers}</div>
  if (error) return <ErrorNotice error={error} />

  return (
    <div>
      {canManage && !inviteOpen && (
        <button className="btn-primary form-open-btn" onClick={() => setInviteOpen(true)}>
          {ut.inviteUser}
        </button>
      )}
      {canManage && inviteOpen && (
        <InviteForm
          roles={roles}
          onClose={() => setInviteOpen(false)}
          onInvited={async () => {
            setInviteOpen(false)
            await load()
          }}
        />
      )}

      {actionError && <ErrorNotice error={actionError} />}

      {/* A card per user, roles as toggle chips: each chip carries its own context
          (role name + on/off state) and is a real touch target — the same picture
          and controls at every width, no matrix to scroll on a phone. */}
      <div className="u-list">
        {users.map((u) => (
          <div key={u.user_id} className="card u-card">
            <div className="u-mail" title={u.email ?? u.user_id}>
              {u.email ?? u.user_id}
            </div>
            <div className="chips">
              {roles.map((r) => {
                const assigned = u.roles.includes(r.key)
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={assigned ? 'chip on' : 'chip'}
                    aria-pressed={assigned}
                    disabled={!canManage || busy === u.user_id + r.id}
                    onClick={() => toggleRole(u, r, assigned)}
                  >
                    {r.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        {users.length === 0 && <div className="card notice">{ut.noUsers}</div>}
      </div>
    </div>
  )
}

function InviteForm({
  roles,
  onClose,
  onInvited,
}: {
  roles: RoleRow[]
  onClose: () => void
  onInvited: () => Promise<void>
}) {
  const ut = useUT()
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await invokeFunction('admin-invite', { email: email.trim(), role_id: roleId })
      await onInvited()
    } catch (e) {
      setError((e as Error).message === 'forbidden' ? ut.inviteErrorForbidden : ut.inviteErrorGeneric)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card u-invite" onSubmit={onSubmit}>
      <label>
        {ut.inviteEmail}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label>
        {ut.inviteRole}
        <select value={roleId} onChange={(e) => setRoleId(e.target.value)} required>
          <option value="" disabled>
            {ut.selectRole}
          </option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </label>

      {error && <ErrorNotice error={error} />}

      <div className="u-invite-actions">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? ut.inviting : ut.inviteSubmit}
        </button>
        <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
          {ut.inviteCancel}
        </button>
      </div>
    </form>
  )
}

/* ------------------------------------------------- Roles × Permissions matrix */

function MatrixTab({ canManage }: { canManage: boolean }) {
  const ut = useUT()
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

  if (loading) return <div className="muted">{ut.loadingPermissions}</div>
  if (error) return <ErrorNotice error={error} />

  return (
    <div className="card">
      <table className="grid grid-sticky-first">
        <thead>
          <tr>
            <th>{ut.permHeader}</th>
            {roles.map((r) => (
              <th key={r.id} className="center">
                {r.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {perms.map((p, i) => (
            <Fragment key={p.id}>
              {/* perms arrive ordered by module — a group header per module keeps
                  the long matrix scannable, especially while phone-scrolling */}
              {(i === 0 || perms[i - 1].module !== p.module) && (
                <tr className="u-permgroup">
                  <td colSpan={roles.length + 1}>
                    <span>{ut.moduleNames[p.module] ?? p.module}</span>
                  </td>
                </tr>
              )}
              <tr>
                <td>
                  <code className="u-permkey">{p.key}</code>
                  <span className="u-permlabel">{p.label}</span>
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
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
