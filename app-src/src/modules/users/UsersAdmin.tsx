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
type UT = ReturnType<typeof useUT>

function ErrorNotice({ error }: { error: string }) {
  const ut = useUT()
  return (
    <div className="error">
      {ut.errorPrefix} {error}
    </div>
  )
}

/** The stable error codes admin-invite / admin-user-ops return, mapped to their
 *  bilingual message. Returns null for unknown codes so each caller can supply
 *  its own generic fallback (invite / lifecycle / password differ). One table
 *  for all three call sites — a new server code is added here once. */
function mapOpError(code: string, ut: UT): string | null {
  switch (code) {
    case 'forbidden':
      return ut.inviteErrorForbidden
    case 'self_forbidden':
      return ut.opErrorSelf
    case 'last_admin':
      return ut.opErrorLastAdmin
    case 'has_records':
      return ut.opErrorHasRecords
    case 'weak_password':
      return ut.pwErrorWeak
    case 'no_email':
      return ut.pwErrorNoEmail
    default:
      return null
  }
}

/** The roles/permissions/grants catalog — the same three reads both tabs need.
 *  Kept in one place so the shape and error handling don't drift between them. */
async function loadRolesCatalog() {
  const [rolesRes, permsRes, rpRes] = await Promise.all([
    core().from('roles').select('*').order('sort'),
    core().from('permissions').select('*').order('module').order('action'),
    core().from('role_permissions').select('*'),
  ])
  return {
    error: (rolesRes.error || permsRes.error || rpRes.error)?.message ?? null,
    roles: (rolesRes.data as RoleRow[] | null) ?? [],
    perms: (permsRes.data as PermissionRow[] | null) ?? [],
    grants: (rpRes.data as RolePermissionRow[] | null) ?? [],
  }
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

/** A GoTrue ban is "deactivated" for us — any banned_until still in the future. */
const isDeactivated = (u: AdminUser) => !!u.banned_until && new Date(u.banned_until) > new Date()

function UsersTab({ canManage }: { canManage: boolean }) {
  const ut = useUT()
  const { user: me, startPreview, refreshPermissions } = useAuth()
  // owner-only lifecycle + password actions; UI mirror of the DB seeds —
  // admin-user-ops re-checks each server-side
  const canDelete = useCan(PERM.usersDelete)
  const canPassword = useCan(PERM.usersPassword)
  const navigate = useNavigate()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])
  // permission catalog + grants power the per-user effective-permissions lens
  // (moved here from the matrix tab, owner decision 2026-07-20)
  const [perms, setPerms] = useState<PermissionRow[]>([])
  const [grants, setGrants] = useState<RolePermissionRow[]>([])
  const [error, setError] = useState<string | null>(null)
  // a failed role toggle (e.g. the last-admin guard rejecting it) shows inline
  // — unlike `error` above, it must not blank out an already-loaded list
  const [actionError, setActionError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [usersRes, catalog] = await Promise.all([core().rpc('admin_list_users'), loadRolesCatalog()])
    if (usersRes.error || catalog.error) setError(usersRes.error?.message ?? catalog.error)
    else {
      setUsers((usersRes.data as AdminUser[] | null) ?? [])
      setRoles(catalog.roles)
      setPerms(catalog.perms)
      setGrants(catalog.grants)
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // role_id -> the permission_ids it grants (one pass, reused by every user's lens)
  const grantsByRole = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const g of grants) {
      const set = m.get(g.role_id)
      if (set) set.add(g.permission_id)
      else m.set(g.role_id, new Set([g.permission_id]))
    }
    return m
  }, [grants])

  async function userOp(action: 'delete' | 'deactivate' | 'reactivate', target: AdminUser) {
    const confirmMsg =
      action === 'delete' ? ut.userDeleteConfirm : action === 'deactivate' ? ut.userDeactivateConfirm : null
    if (confirmMsg && !window.confirm(`${confirmMsg} (${target.email ?? target.user_id})`)) return
    setBusy(target.user_id + action)
    setActionError(null)
    try {
      await invokeFunction('admin-user-ops', { action, user_id: target.user_id })
      await load()
    } catch (e) {
      // admin-user-ops returns a stable error code (server stays language-agnostic)
      setActionError(mapOpError((e as Error).message, ut) ?? ut.opErrorGeneric)
    } finally {
      setBusy(null)
    }
  }

  async function toggleRole(user: AdminUser, role: RoleRow, assigned: boolean) {
    setBusy(user.user_id + role.id)
    setActionError(null)
    const table = core().from('user_roles')
    const res = assigned
      ? await table.delete().eq('user_id', user.user_id).eq('role_id', role.id)
      : await table.insert({ user_id: user.user_id, role_id: role.id })
    setBusy(null)
    if (res.error) setActionError(res.error.message)
    else {
      // toggling my own roles changes my grants — refresh the UI mirror too
      if (user.user_id === me?.id) await Promise.all([load(), refreshPermissions()])
      else await load()
    }
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

      {/* One accordion row per user: collapsed shows the essentials (email +
          status + assigned roles at a glance); expanded consolidates ALL of a
          user's data + actions — roles, effective permissions, lifecycle,
          password, view-as (owner decision 2026-07-20). Same interaction at
          every width. */}
      <div className="u-list">
        {users.map((u) => (
          <UserRow
            key={u.user_id}
            u={u}
            roles={roles}
            perms={perms}
            grantsByRole={grantsByRole}
            isSelf={u.user_id === me?.id}
            canManage={canManage}
            canDelete={canDelete}
            canPassword={canPassword}
            busy={busy}
            onToggleRole={toggleRole}
            onUserOp={userOp}
            onViewAs={(email, keys) => {
              if (startPreview(email, keys)) navigate('/')
            }}
          />
        ))}
        {users.length === 0 && <div className="card notice">{ut.noUsers}</div>}
      </div>
    </div>
  )
}

/** One user's accordion row. Effective permissions are derived client-side from
 *  the user's roles ∩ role grants — identical to what core.my_permissions()
 *  derives server-side (no per-user overrides; owner decision 2026-07-15). */
function UserRow({
  u,
  roles,
  perms,
  grantsByRole,
  isSelf,
  canManage,
  canDelete,
  canPassword,
  busy,
  onToggleRole,
  onUserOp,
  onViewAs,
}: {
  u: AdminUser
  roles: RoleRow[]
  perms: PermissionRow[]
  grantsByRole: Map<string, Set<string>>
  isSelf: boolean
  canManage: boolean
  canDelete: boolean
  canPassword: boolean
  busy: string | null
  onToggleRole: (u: AdminUser, r: RoleRow, assigned: boolean) => void
  onUserOp: (action: 'delete' | 'deactivate' | 'reactivate', u: AdminUser) => void
  onViewAs: (email: string, keys: string[]) => void
}) {
  const ut = useUT()
  const roleName = useRoleName()
  const deactivated = isDeactivated(u)
  const assignedRoles = roles.filter((r) => u.roles.includes(r.key))

  // permission_id -> names of the roles granting it (for the "via" line + view-as)
  const { visible, via } = useMemo(() => {
    const viaMap = new Map<string, string[]>()
    for (const r of assignedRoles) {
      const grantSet = grantsByRole.get(r.id)
      if (!grantSet) continue
      const name = roleName(r) // once per role, not once per granted permission
      for (const p of perms) {
        if (!grantSet.has(p.id)) continue
        const list = viaMap.get(p.id)
        if (list) list.push(name)
        else viaMap.set(p.id, [name])
      }
    }
    return { visible: perms.filter((p) => viaMap.has(p.id)), via: viaMap }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [u.roles, roles, perms, grantsByRole, roleName])

  return (
    <details className="card u-card">
      <summary className="u-summary">
        <span className="u-mail" title={u.email ?? u.user_id}>
          {u.email ?? u.user_id}
          {deactivated && <span className="u-banned">{ut.userDeactivated}</span>}
        </span>
        <span className="u-summaryroles">
          {assignedRoles.length > 0 ? (
            assignedRoles.map((r) => (
              <span key={r.id} className="u-rolepill">
                {roleName(r)}
              </span>
            ))
          ) : (
            <span className="muted">—</span>
          )}
        </span>
      </summary>

      <div className="u-detail">
        <LastLogin at={u.last_sign_in_at} />

        {/* roles — editable toggle chips */}
        <div className="u-detailsec">
          <div className="u-seclabel">{ut.secRoles}</div>
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
                  onClick={() => onToggleRole(u, r, assigned)}
                >
                  {roleName(r)}
                </button>
              )
            })}
          </div>
        </div>

        {/* effective permissions — read-only lens (moved out of the matrix tab) */}
        <div className="u-detailsec">
          <div className="u-seclabel">{ut.secPerms}</div>
          <p className="muted u-effectivenote">{ut.effectiveNote}</p>
          {visible.length === 0 ? (
            <div className="notice">{ut.noPerms}</div>
          ) : (
            visible.map((p, i) => (
              <Fragment key={p.id}>
                {(i === 0 || visible[i - 1].module !== p.module) && (
                  <div className="u-moduleband u-effmodule">{ut.moduleNames[p.module] ?? p.module}</div>
                )}
                <div className="u-effperm">
                  <code className="u-permkey">{p.key}</code>
                  <span className="u-permlabel">{p.label}</span>
                  <span className="u-effvia muted">
                    {ut.viaRole}: {via.get(p.id)!.join(', ')}
                  </span>
                </div>
              </Fragment>
            ))
          )}
        </div>

        {/* actions — view-as (manage), password (owner), lifecycle (owner).
            Lifecycle never targets your own account; password may. */}
        {(canManage || canDelete || canPassword) && (
          <div className="u-detailsec">
            <div className="u-seclabel">{ut.secActions}</div>
            <div className="u-userops">
              {canManage && (
                <button
                  type="button"
                  className="u-opbtn"
                  onClick={() => onViewAs(u.email ?? u.user_id, visible.map((p) => p.key))}
                >
                  {ut.viewAs}
                </button>
              )}
              {canDelete && !isSelf && (
                <button
                  type="button"
                  className="u-opbtn"
                  disabled={busy !== null}
                  onClick={() => onUserOp(deactivated ? 'reactivate' : 'deactivate', u)}
                >
                  {deactivated ? ut.userReactivate : ut.userDeactivate}
                </button>
              )}
              {canDelete && !isSelf && (
                <button
                  type="button"
                  className="u-opbtn u-danger"
                  disabled={busy !== null}
                  onClick={() => onUserOp('delete', u)}
                >
                  {ut.userDelete}
                </button>
              )}
            </div>
            {canPassword && <PasswordPanel user={u} />}
          </div>
        )}
      </div>
    </details>
  )
}

/** Owner-only: set a user's password directly, or send them a reset link.
 *  Both actions re-check users.password server-side in admin-user-ops; the
 *  typed password never leaves this component except in the one privileged call. */
function PasswordPanel({ user }: { user: AdminUser }) {
  const ut = useUT()
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState<'set' | 'reset' | null>(null)
  // one banner: success xor error — the two are mutually exclusive
  const [result, setResult] = useState<{ ok: string } | { err: string } | null>(null)

  async function setPassword(e: FormEvent) {
    e.preventDefault()
    setBusy('set')
    setResult(null)
    try {
      await invokeFunction('admin-user-ops', {
        action: 'set_password',
        user_id: user.user_id,
        password: pw,
      })
      setPw('')
      setResult({ ok: ut.pwSetOk })
    } catch (e) {
      setResult({ err: mapOpError((e as Error).message, ut) ?? ut.pwErrorGeneric })
    } finally {
      setBusy(null)
    }
  }

  async function sendReset() {
    setBusy('reset')
    setResult(null)
    try {
      await invokeFunction('admin-user-ops', { action: 'send_reset', user_id: user.user_id })
      setResult({ ok: ut.pwResetSent })
    } catch (e) {
      setResult({ err: mapOpError((e as Error).message, ut) ?? ut.pwErrorGeneric })
    } finally {
      setBusy(null)
    }
  }

  if (!open) {
    return (
      <button type="button" className="u-opbtn u-pwtoggle" onClick={() => setOpen(true)}>
        {ut.setPassword}
      </button>
    )
  }

  return (
    <div className="u-pwpanel">
      <form className="u-pwset" onSubmit={setPassword}>
        <label>
          {ut.pwNewLabel}
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            minLength={8}
            autoComplete="new-password"
            required
          />
        </label>
        <div className="u-actions">
          <button type="submit" className="u-opbtn" disabled={busy !== null}>
            {busy === 'set' ? ut.pwApplying : ut.pwApply}
          </button>
          <button type="button" className="u-opbtn" disabled={busy !== null} onClick={sendReset}>
            {busy === 'reset' ? ut.pwSending : ut.pwSendResetOption}
          </button>
          <button
            type="button"
            className="u-opbtn"
            disabled={busy !== null}
            onClick={() => {
              setOpen(false)
              setPw('')
              setResult(null)
            }}
          >
            {ut.inviteCancel}
          </button>
        </div>
      </form>
      {result && ('ok' in result ? <p className="notice u-pwmsg">{result.ok}</p> : <ErrorNotice error={result.err} />)}
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
      setError(mapOpError((e as Error).message, ut) ?? ut.inviteErrorGeneric)
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

function MatrixTab({ canManage }: { canManage: boolean }) {
  const ut = useUT()
  const roleName = useRoleName()
  const { refreshPermissions } = useAuth()
  const isPhone = useMediaQuery(PHONE_MQ)
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [perms, setPerms] = useState<PermissionRow[]>([])
  // saved DB state vs. local edits — nothing is written until Save
  const [baseline, setBaseline] = useState<Set<string>>(new Set()) // `${role_id}:${permission_id}`
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const catalog = await loadRolesCatalog()
    if (catalog.error) {
      setError(catalog.error)
    } else {
      const grants = new Set(catalog.grants.map((g) => `${g.role_id}:${g.permission_id}`))
      setRoles(catalog.roles)
      setPerms(catalog.perms)
      setBaseline(grants)
      setPending(new Set(grants))
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

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
      {error && <ErrorNotice error={error} />}

      {canManage && <RolesManager roles={roles} onChanged={load} locked={dirtyCount > 0} />}

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

/** Create / rename / delete roles. Built-ins are editable/deletable by owner
 *  decision (2026-07-15) — the DB's last-admin guard (incl. its cascade-aware
 *  trigger on core.roles) + cascades are the safety net. Rename edits only the
 *  bilingual display labels; the `key` is never changed (permissions reference
 *  it). Locked while the matrix has unsaved edits: role changes reload the
 *  matrix, which would silently wipe the pending toggles. */
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
  // null = closed; 'new' = create form; a role.id = renaming that role
  const [editing, setEditing] = useState<string | null>(null)
  const [key, setKey] = useState('')
  const [labelHe, setLabelHe] = useState('')
  const [labelAr, setLabelAr] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openNew() {
    setEditing('new')
    setKey('')
    setLabelHe('')
    setLabelAr('')
    setError(null)
  }
  function openRename(r: RoleRow) {
    setEditing(r.id)
    setKey(r.key)
    setLabelHe(r.label_he ?? '')
    setLabelAr(r.label_ar ?? '')
    setError(null)
  }
  function close() {
    setEditing(null)
    setError(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const he = labelHe.trim()
    const ar = labelAr.trim()
    const res =
      editing === 'new'
        ? await core().from('roles').insert({ key: key.trim(), label_he: he, label_ar: ar, sort: 500 })
        : await core().from('roles').update({ label_he: he, label_ar: ar }).eq('id', editing)
    setBusy(false)
    if (res.error) {
      setError(res.error.message)
      return
    }
    close()
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
              className="u-roleedit"
              aria-label={`${ut.roleRename} ${roleName(r)}`}
              disabled={busy || locked}
              onClick={() => openRename(r)}
            >
              ✎
            </button>
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
        {editing === null && (
          <button type="button" className="chip" disabled={busy || locked} onClick={openNew}>
            {ut.addRole}
          </button>
        )}
      </div>
      {locked && <p className="muted u-rolesmgr-locked">{ut.rolesLocked}</p>}

      {editing !== null && (
        <form className="card u-invite" onSubmit={submit}>
          {editing === 'new' && (
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
          )}
          <label>
            {ut.roleLabelHe}
            <input value={labelHe} onChange={(e) => setLabelHe(e.target.value)} required />
          </label>
          <label>
            {ut.roleLabelAr}
            <input value={labelAr} onChange={(e) => setLabelAr(e.target.value)} required />
          </label>
          <div className="u-actions">
            <button type="submit" className="btn-primary" disabled={busy}>
              {editing === 'new' ? (busy ? ut.roleCreating : ut.roleCreate) : busy ? ut.roleSaving : ut.roleSave}
            </button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={close}>
              {ut.inviteCancel}
            </button>
          </div>
        </form>
      )}

      {error && <ErrorNotice error={error} />}
    </div>
  )
}
