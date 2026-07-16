import { Fragment, useEffect, useMemo, useState, useCallback, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { core, invokeFunction } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useCan, PERM } from '../../lib/permissions'
import { useI18n, useRoleName } from '../../lib/i18n'
import { useMediaQuery, PHONE_MQ } from '../../lib/useMediaQuery'
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

// hoisted: Intl formatter construction is expensive and there are only two shapes
const LAST_LOGIN_FMT = {
  he: new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short' }),
  ar: new Intl.DateTimeFormat('ar', { dateStyle: 'short', timeStyle: 'short' }),
} as const

/** Last sign-in, in the active language's locale (or "never"). */
function LastLogin({ at }: { at: string | null }) {
  const ut = useUT()
  const { lang } = useI18n()
  return (
    <div className="u-lastlogin muted">
      {ut.lastLogin} {at ? LAST_LOGIN_FMT[lang].format(new Date(at)) : ut.neverLoggedIn}
    </div>
  )
}

/* ------------------------------------------------------------------ Users tab */

function UsersTab({ canManage }: { canManage: boolean }) {
  const ut = useUT()
  const roleName = useRoleName()
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
            <LastLogin at={u.last_sign_in_at} />
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
                    {roleName(r)}
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
  const roleName = useRoleName()
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
              {roleName(r)}
            </option>
          ))}
        </select>
      </label>

      {error && <ErrorNotice error={error} />}

      <div className="u-actions">
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

type MatrixView = 'byRole' | 'byUser'

function MatrixTab({ canManage }: { canManage: boolean }) {
  const ut = useUT()
  const roleName = useRoleName()
  const { refreshPermissions } = useAuth()
  const isPhone = useMediaQuery(PHONE_MQ)
  const [view, setView] = useState<MatrixView>('byRole')
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [perms, setPerms] = useState<PermissionRow[]>([])
  // saved DB state vs. local edits — nothing is written until Save
  const [baseline, setBaseline] = useState<Set<string>>(new Set()) // `${role_id}:${permission_id}`
  const [pending, setPending] = useState<Set<string>>(new Set())
  // loaded lazily on the first switch to the by-user lens
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
      const grants = new Set(
        ((rpRes.data as RolePermissionRow[] | null) ?? []).map(
          (g) => `${g.role_id}:${g.permission_id}`,
        ),
      )
      setRoles((rolesRes.data as RoleRow[] | null) ?? [])
      setPerms((permsRes.data as PermissionRow[] | null) ?? [])
      setBaseline(grants)
      setPending(new Set(grants))
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // resetting `usersFailed` re-fires this effect — that's the retry path
  const [usersFailed, setUsersFailed] = useState(false)
  useEffect(() => {
    if (view !== 'byUser' || users !== null || usersFailed) return
    let live = true
    void core()
      .rpc('admin_list_users')
      .then(({ data, error }) => {
        if (!live) return
        if (error) {
          setError(error.message)
          setUsersFailed(true)
        } else {
          setUsers((data as AdminUser[] | null) ?? [])
        }
      })
    return () => {
      live = false
    }
  }, [view, users, usersFailed])

  const toPair = (k: string) => {
    const [role_id, permission_id] = k.split(':')
    return { role_id, permission_id }
  }
  const { adds, removes } = useMemo(
    () => ({
      adds: [...pending].filter((k) => !baseline.has(k)).map(toPair),
      removes: [...baseline].filter((k) => !pending.has(k)).map(toPair),
    }),
    [pending, baseline],
  )
  const dirtyCount = adds.length + removes.length

  // perms arrive module-ordered — one grouping drives the desktop grid's header
  // rows AND the phone accordion sections
  const moduleGroups = useMemo(() => {
    const groups: { module: string; perms: PermissionRow[] }[] = []
    for (const p of perms) {
      const last = groups[groups.length - 1]
      if (last && last.module === p.module) last.perms.push(p)
      else groups.push({ module: p.module, perms: [p] })
    }
    return groups
  }, [perms])

  function toggle(role: RoleRow, perm: PermissionRow) {
    const key = `${role.id}:${perm.id}`
    setPending((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function save() {
    setSaving(true)
    setError(null)
    // one atomic RPC (core.apply_role_permissions): the whole batch commits or
    // rolls back together — a half-applied matrix is impossible, and the DB's
    // last-admin guard sees the true net state (adds run before removes there)
    const res = await core().rpc('apply_role_permissions', {
      p_adds: adds,
      p_removes: removes,
    })
    if (res.error) {
      // nothing persisted (atomic) — keep the pending edits so a retry is one tap
      setError(res.error.message)
      setSaving(false)
      return
    }
    // own grants may have just changed — refresh the UI mirror alongside the reload
    await Promise.all([load(), refreshPermissions()])
    setSaving(false)
  }

  // full-screen loading only before the first paint — a reload after Save keeps
  // the matrix mounted (otherwise every save collapses the phone accordions
  // and throws the scroll position away)
  if (loading && roles.length === 0) return <div className="muted">{ut.loadingPermissions}</div>
  if (error && roles.length === 0) return <ErrorNotice error={error} />

  return (
    <div>
      <div className="seg seg-2 u-viewswitch">
        <button
          type="button"
          className={view === 'byRole' ? 'seg-btn on' : 'seg-btn'}
          onClick={() => setView('byRole')}
        >
          {ut.viewByRole}
        </button>
        <button
          type="button"
          className={view === 'byUser' ? 'seg-btn on' : 'seg-btn'}
          onClick={() => setView('byUser')}
        >
          {ut.viewByUser}
        </button>
      </div>

      {error && <ErrorNotice error={error} />}

      {view === 'byRole' ? (
        <>
          {canManage && (
            <RolesManager roles={roles} onChanged={load} locked={dirtyCount > 0} />
          )}

          {isPhone ? (
            /* phone: per-module accordion, roles as toggle chips (plan §UI —
               a wide checkbox grid doesn't survive phone width; chips are the
               same touch pattern the users tab already established) */
            <div className="u-matrix-phone">
              {moduleGroups.map((g) => (
                <details key={g.module} className="card u-permacc">
                  <summary>
                    {ut.moduleNames[g.module] ?? g.module}
                    <span className="badge">{g.perms.length}</span>
                  </summary>
                  {g.perms.map((p) => (
                    <div key={p.id} className="u-accperm">
                      <div>
                        <code className="u-permkey">{p.key}</code>
                        <span className="u-permlabel">{p.label}</span>
                      </div>
                      <div className="chips">
                        {roles.map((r) => {
                          const key = `${r.id}:${p.id}`
                          const checked = pending.has(key)
                          const changed = checked !== baseline.has(key)
                          return (
                            <button
                              key={r.id}
                              type="button"
                              className={
                                (checked ? 'chip on' : 'chip') + (changed ? ' u-chip-dirty' : '')
                              }
                              aria-pressed={checked}
                              disabled={!canManage || saving}
                              onClick={() => toggle(r, p)}
                            >
                              {roleName(r)}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </details>
              ))}
            </div>
          ) : (
          <div className="card">
            <table className="grid grid-sticky-first">
              <thead>
                <tr>
                  <th>{ut.permHeader}</th>
                  {roles.map((r) => (
                    <th key={r.id} className="center">
                      {roleName(r)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {moduleGroups.map((g) => (
                  <Fragment key={g.module}>
                    <tr className="u-permgroup">
                      <td className="u-moduleband" colSpan={roles.length + 1}>
                        <span>{ut.moduleNames[g.module] ?? g.module}</span>
                      </td>
                    </tr>
                    {g.perms.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <code className="u-permkey">{p.key}</code>
                          <span className="u-permlabel">{p.label}</span>
                        </td>
                        {roles.map((r) => {
                          const key = `${r.id}:${p.id}`
                          const checked = pending.has(key)
                          const changed = checked !== baseline.has(key)
                          return (
                            <td key={r.id} className={changed ? 'center u-cell-dirty' : 'center'}>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!canManage || saving}
                                onChange={() => toggle(r, p)}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </>
      ) : usersFailed ? (
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            setError(null)
            setUsersFailed(false)
          }}
        >
          {ut.retry}
        </button>
      ) : (
        /* the lens shows the PENDING state — what the matrix will look like
           after Save — so an admin can preview a batch's effect per user */
        <ByUserView
          users={users}
          roles={roles}
          perms={perms}
          grants={pending}
          canManage={canManage}
          dirty={dirtyCount > 0}
        />
      )}

      {/* visible in BOTH views: unsaved edits must never be off-screen */}
      {canManage && dirtyCount > 0 && (
        <div className="u-savebar card">
          <span>
            {ut.pendingChanges} {dirtyCount}
          </span>
          <div className="u-actions">
            <button type="button" className="btn-primary" disabled={saving} onClick={save}>
              {saving ? ut.saving : ut.save}
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={saving}
              onClick={() => {
                setPending(new Set(baseline))
                setError(null)
              }}
            >
              {ut.discard}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Create/delete roles. Built-ins are editable/deletable by owner decision
 *  (2026-07-15) — the DB's last-admin guard (incl. its cascade-aware trigger
 *  on core.roles) + cascades are the safety net. Locked while the matrix has
 *  unsaved edits: role changes reload the matrix, which would silently wipe
 *  the pending toggles. */
function RolesManager({
  roles,
  onChanged,
  locked,
}: {
  roles: RoleRow[]
  onChanged: () => Promise<void>
  locked: boolean
}) {
  const ut = useUT()
  const roleName = useRoleName()
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await core()
      .from('roles')
      .insert({ key: key.trim(), label: label.trim(), sort: 500 })
    setBusy(false)
    if (res.error) {
      setError(res.error.message)
      return
    }
    setKey('')
    setLabel('')
    setOpen(false)
    await onChanged()
  }

  async function remove(role: RoleRow) {
    if (!window.confirm(`${ut.roleDeleteConfirm} (${roleName(role)})`)) return
    setBusy(true)
    setError(null)
    const res = await core().from('roles').delete().eq('id', role.id)
    setBusy(false)
    if (res.error) {
      setError(res.error.message)
      return
    }
    await onChanged()
  }

  return (
    <div className="u-rolesmgr">
      <div className="chips">
        {roles.map((r) => (
          <span key={r.id} className="chip on u-rolechip">
            {roleName(r)}
            <button
              type="button"
              className="u-roledel"
              aria-label={`${ut.roleDelete} ${roleName(r)}`}
              disabled={busy || locked}
              onClick={() => remove(r)}
            >
              ×
            </button>
          </span>
        ))}
        {!open && (
          <button
            type="button"
            className="chip"
            disabled={busy || locked}
            onClick={() => setOpen(true)}
          >
            {ut.addRole}
          </button>
        )}
      </div>
      {locked && <p className="muted u-rolesmgr-locked">{ut.rolesLocked}</p>}

      {open && (
        <form className="card u-invite" onSubmit={create}>
          <label>
            {ut.roleKeyLabel}
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              pattern="[a-z][a-z0-9_]{1,30}"
              title={ut.roleKeyHint}
              required
            />
          </label>
          <label>
            {ut.roleLabelLabel}
            <input value={label} onChange={(e) => setLabel(e.target.value)} required />
          </label>
          <div className="u-actions">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? ut.roleCreating : ut.roleCreate}
            </button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => setOpen(false)}>
              {ut.inviteCancel}
            </button>
          </div>
        </form>
      )}

      {error && <ErrorNotice error={error} />}
    </div>
  )
}

/** Read-only lens: a user's EFFECTIVE permissions, derived from their roles
 *  (owner decision 2026-07-15: no per-user overrides — editing happens on the
 *  role, in the by-role view). Derivation is client-side over the same catalog
 *  the by-role grid loads; the DB derives identically in core.my_permissions(). */
function ByUserView({
  users,
  roles,
  perms,
  grants,
  canManage,
  dirty,
}: {
  users: AdminUser[] | null
  roles: RoleRow[]
  perms: PermissionRow[]
  grants: Set<string>
  canManage: boolean
  dirty: boolean
}) {
  const ut = useUT()
  const roleName = useRoleName()
  const { startPreview } = useAuth()
  const navigate = useNavigate()
  const [userId, setUserId] = useState('')
  const selected = users?.find((u) => u.user_id === userId) ?? null

  // permission_id -> names of the roles granting it
  const effective = useMemo(() => {
    const out = new Map<string, string[]>()
    if (!selected) return out
    for (const r of roles.filter((r) => selected.roles.includes(r.key))) {
      for (const p of perms) {
        if (!grants.has(`${r.id}:${p.id}`)) continue
        const via = out.get(p.id)
        if (via) via.push(roleName(r))
        else out.set(p.id, [roleName(r)])
      }
    }
    return out
  }, [selected, roles, perms, grants, roleName])

  // perms arrive module-ordered — same boundary-header pattern as the grid
  const visible = perms.filter((p) => effective.has(p.id))

  if (users === null) return <div className="muted">{ut.loadingUsers}</div>

  return (
    <div className="card u-byuser">
      <div className="u-invite">
        <label>
          {ut.selectUser}
          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">—</option>
            {users.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.email ?? u.user_id}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selected && (
        <>
          {canManage && (
            /* preview must reflect the SAVED state — while edits are dirty the
               derived keys would promise permissions the DB doesn't grant yet
               (the sticky save bar right below explains what's pending) */
            <button
              type="button"
              className="btn-primary u-viewas"
              disabled={dirty}
              onClick={() => {
                if (startPreview(selected.email ?? selected.user_id, visible.map((p) => p.key)))
                  navigate('/')
              }}
            >
              {ut.viewAs}
            </button>
          )}
          <p className="muted u-effectivenote">{ut.effectiveNote}</p>
          {visible.length === 0 && <div className="notice">{ut.noPerms}</div>}
          {visible.map((p, i) => (
            <Fragment key={p.id}>
              {(i === 0 || visible[i - 1].module !== p.module) && (
                <div className="u-moduleband u-effmodule">
                  {ut.moduleNames[p.module] ?? p.module}
                </div>
              )}
              <div className="u-effperm">
                <code className="u-permkey">{p.key}</code>
                <span className="u-permlabel">{p.label}</span>
                <span className="u-effvia muted">
                  {ut.viaRole}: {effective.get(p.id)!.join(', ')}
                </span>
              </div>
            </Fragment>
          ))}
        </>
      )}
    </div>
  )
}
