import { useEffect, useMemo, useState, useCallback, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { core, invokeFunction } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useCan, PERM } from '../../lib/permissions'
import { useI18n, useRoleName } from '../../lib/i18n'
import type { AdminUser, RoleRow, PermissionRow, RolePermissionRow } from '../../types'
import { useUT } from './i18n'
import './users.css'

type Tab = 'users' | 'matrix' | 'byrole'
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
  // invite lives at this level so its trigger can sit up in the tab bar
  const [inviteOpen, setInviteOpen] = useState(false)

  return (
    <section className="u-module">
      <h1 className="page-title">{ut.title}</h1>
      {!canManage && (
        <p className="notice">
          {ut.viewOnly} ({PERM.usersManage}).
        </p>
      )}

      <div className="u-tabbar">
        <div className="tabs">
          <button className={tab === 'users' ? 'tab on' : 'tab'} onClick={() => setTab('users')}>
            {ut.tabUsers}
          </button>
          <button className={tab === 'matrix' ? 'tab on' : 'tab'} onClick={() => setTab('matrix')}>
            {ut.tabMatrix}
          </button>
          <button className={tab === 'byrole' ? 'tab on' : 'tab'} onClick={() => setTab('byrole')}>
            {ut.tabByRole}
          </button>
        </div>
        {tab === 'users' && canManage && !inviteOpen && (
          <button className="btn-primary u-invite-btn" onClick={() => setInviteOpen(true)}>
            {ut.inviteUser}
          </button>
        )}
      </div>

      {tab === 'users' ? (
        <UsersTab canManage={canManage} inviteOpen={inviteOpen} setInviteOpen={setInviteOpen} />
      ) : tab === 'matrix' ? (
        <MatrixTab canManage={canManage} />
      ) : (
        <ByRoleTab canManage={canManage} />
      )}
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

/** Up-to-two-letter avatar initials from the email's local part (Latin, so safe
 *  to uppercase). Falls back to the user id's first chars for email-less rows. */
function initials(email: string | null, fallback: string): string {
  const local = (email ?? fallback).split('@')[0]
  const parts = local.split(/[.\-_]+/).filter(Boolean)
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2)
  return chars.toUpperCase()
}

/* ------------------------------------------------------------------ Users tab */

/** A GoTrue ban is "deactivated" for us — any banned_until still in the future. */
const isDeactivated = (u: AdminUser) => !!u.banned_until && new Date(u.banned_until) > new Date()

/** Invited but never accepted: with mailer_autoconfirm off, GoTrue refuses this
 *  user's password sign-in outright (email_not_confirmed) — so it's a blocking
 *  account state the owner needs to see and can clear (admin-user-ops
 *  confirm_email). See docs/modules/users.md, 2026-07-30.
 *
 *  Explicit `=== null`, not falsy: prod's DB is migrated by hand while the UI
 *  ships on push, so the field can be *absent* from the RPC payload for a window
 *  after a deploy (or while PostgREST's schema cache is stale). Absent must read
 *  as "nothing to report" — falsy would flag every user in the list at once.
 *  An address-less account is excluded too: there is no address to confirm, so
 *  "not confirmed" would be the wrong story (and the action would 400). */
const isUnconfirmed = (u: AdminUser) => u.email_confirmed_at === null && !!u.email

/** The admin-user-ops actions reachable straight from a user row (no extra input).
 *  set_password/send_reset live in PasswordForm instead — they need a form. */
type UserOp = 'delete' | 'deactivate' | 'reactivate' | 'confirm_email'

function UsersTab({
  canManage,
  inviteOpen,
  setInviteOpen,
}: {
  canManage: boolean
  inviteOpen: boolean
  setInviteOpen: (open: boolean) => void
}) {
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

  async function userOp(action: UserOp, target: AdminUser) {
    // exhaustive by type: a new UserOp won't compile until it states whether it
    // needs a confirmation prompt (reactivate deliberately doesn't).
    const prompts: Record<UserOp, string | null> = {
      delete: ut.userDeleteConfirm,
      deactivate: ut.userDeactivateConfirm,
      confirm_email: ut.confirmEmailConfirm,
      reactivate: null,
    }
    const confirmMsg = prompts[action]
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
            onReload={load}
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
  onReload,
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
  onUserOp: (action: UserOp, u: AdminUser) => void
  /** Re-read the users list — for actions that change row data outside onUserOp. */
  onReload: () => Promise<void>

  onViewAs: (email: string, keys: string[]) => void
}) {
  const ut = useUT()
  const roleName = useRoleName()
  const deactivated = isDeactivated(u)
  // Status line: deactivated outranks unconfirmed — an explicit ban is the
  // stronger, deliberate state, and lifting it is the action that matters first.
  const status = deactivated
    ? { dot: 'u-dot u-dot-off', label: ut.userDeactivated, warn: false }
    : isUnconfirmed(u)
      ? { dot: 'u-dot u-dot-warn', label: ut.userUnconfirmed, warn: true }
      : { dot: 'u-dot', label: ut.statusActive, warn: false }
  // The action stays offered while banned (unlike the status line, which ranks
  // the ban higher) — both states block sign-in and both need clearing.
  // !isSelf mirrors the server (POLICY.confirm_email is allowSelf: false), so the
  // pill is never a button that can only fail.
  const canConfirmEmail = canPassword && !isSelf && isUnconfirmed(u)
  const assignedRoles = roles.filter((r) => u.roles.includes(r.key))
  const [pwOpen, setPwOpen] = useState(false)

  // effective access derived from the user's roles ∩ role grants. `permKeys`
  // feeds view-as; `access` is the concise per-module summary shown on the card
  // (the full permission list lives in the permissions tabs, not here).
  const { permKeys, access } = useMemo(() => {
    const grantedIds = new Set<string>()
    for (const r of assignedRoles) {
      const grantSet = grantsByRole.get(r.id)
      if (grantSet) for (const id of grantSet) grantedIds.add(id)
    }
    const granted = perms.filter((p) => grantedIds.has(p.id))
    const counts = new Map<string, number>()
    for (const p of granted) counts.set(p.module, (counts.get(p.module) ?? 0) + 1)
    return {
      permKeys: granted.map((p) => p.key),
      access: [...counts.entries()].map(([module, count]) => ({ module, count })),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [u.roles, roles, perms, grantsByRole])

  return (
    <details className={deactivated ? 'card u-card u-card-off' : 'card u-card'}>
      <summary className="u-summary">
        <span className={deactivated ? 'u-avatar u-avatar-off' : 'u-avatar'} aria-hidden="true">
          {initials(u.email, u.user_id)}
        </span>
        <span className="u-idcol">
          <span className="u-mail" title={u.email ?? u.user_id}>
            {u.email ?? u.user_id}
          </span>
          <span className={status.warn ? 'u-substatus u-substatus-warn' : 'u-substatus'}>
            <span className={status.dot} aria-hidden="true" />
            {status.label}
          </span>
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

        {/* module access — a concise summary of what the user can reach; the
            full permission list lives in the Roles/By-role tabs, not here */}
        <div className="u-detailsec">
          <div className="u-seclabel">{ut.secAccess}</div>
          {access.length === 0 ? (
            <p className="muted u-emptyline">{ut.noPerms}</p>
          ) : (
            <div className="u-access">
              {access.map(({ module, count }) => (
                <span key={module} className="u-accesstag">
                  {ut.moduleNames[module] ?? module}
                  <span className="u-accesscount">{count}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* actions — view-as (manage), confirm-email + password (owner, orange
            accent), lifecycle (owner). Lifecycle never targets your own account. */}
        {(canManage || canDelete || canPassword) && (
          <div className="u-detailsec">
            <div className="u-seclabel">{ut.secActions}</div>
            <div className="u-userops">
              {canManage && (
                <button
                  type="button"
                  className="u-opbtn"
                  onClick={() => onViewAs(u.email ?? u.user_id, permKeys)}
                >
                  {ut.viewAs}
                </button>
              )}
              {canConfirmEmail && (
                <button
                  type="button"
                  className="u-opbtn u-op-accent"
                  disabled={busy !== null}
                  onClick={() => onUserOp('confirm_email', u)}
                >
                  {ut.confirmEmail}
                </button>
              )}
              {canPassword && (
                <button
                  type="button"
                  className={pwOpen ? 'u-opbtn u-op-accent u-op-on' : 'u-opbtn u-op-accent'}
                  aria-expanded={pwOpen}
                  onClick={() => setPwOpen((o) => !o)}
                >
                  {ut.setPassword}
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
                  className="u-opbtn u-danger u-op-end"
                  disabled={busy !== null}
                  onClick={() => onUserOp('delete', u)}
                >
                  {ut.userDelete}
                </button>
              )}
            </div>
            {/* why the account is stuck — otherwise "correct password still fails"
                reads as a mystery (the live 2026-07-30 report) */}
            {canConfirmEmail && <p className="muted u-ophint">{ut.confirmEmailHint}</p>}
            {canPassword && pwOpen && (
              <PasswordForm user={u} onDone={() => setPwOpen(false)} onChanged={onReload} />
            )}
          </div>
        )}

        {/* quiet footer meta */}
        <div className="u-detailfoot">
          <LastLogin at={u.last_sign_in_at} />
        </div>
      </div>
    </details>
  )
}

/** Owner-only: set a user's password directly, or send them a reset link.
 *  Rendered below the actions row when its toggle (in UserRow) is open. Both
 *  actions re-check users.password server-side in admin-user-ops; the typed
 *  password never leaves this component except in the one privileged call. */
function PasswordForm({
  user,
  onDone,
  onChanged,
}: {
  user: AdminUser
  onDone: () => void
  /** set_password also clears an unconfirmed email server-side, so the row's own
   *  status/actions go stale on success — re-read the list (the panel stays open,
   *  success banner and all; the row keeps its identity via its user_id key). */
  onChanged: () => Promise<void>
}) {
  const ut = useUT()
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
      await onChanged()
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
          <button type="submit" className="btn-primary btn-sm u-btn-accent" disabled={busy !== null}>
            {busy === 'set' ? ut.pwApplying : ut.pwApply}
          </button>
          <button type="button" className="u-opbtn" disabled={busy !== null} onClick={sendReset}>
            {busy === 'reset' ? ut.pwSending : ut.pwSendResetOption}
          </button>
          <button type="button" className="u-opbtn" disabled={busy !== null} onClick={onDone}>
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

/** Shared editing engine for both permission views (all-roles matrix + by-role):
 *  loads the catalog, tracks saved-vs-pending grants, and commits the whole batch
 *  atomically via core.apply_role_permissions. Grants are keyed `${roleId}:${permId}`.
 *  Each view mounts its own instance (fresh load); switching top-level tabs discards
 *  in-flight edits, same as before. */
function usePermissionMatrix() {
  const { refreshPermissions } = useAuth()
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [perms, setPerms] = useState<PermissionRow[]>([])
  const [baseline, setBaseline] = useState<Set<string>>(new Set())
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

  const { adds, removes } = useMemo(() => {
    const toPair = (k: string) => {
      const [role_id, permission_id] = k.split(':')
      return { role_id, permission_id }
    }
    return {
      adds: [...pending].filter((k) => !baseline.has(k)).map(toPair),
      removes: [...baseline].filter((k) => !pending.has(k)).map(toPair),
    }
  }, [pending, baseline])
  const dirtyCount = adds.length + removes.length

  // perms arrive module-ordered — one grouping drives every accordion
  const moduleGroups = useMemo(() => {
    const groups: { module: string; perms: PermissionRow[] }[] = []
    for (const p of perms) {
      const last = groups[groups.length - 1]
      if (last && last.module === p.module) last.perms.push(p)
      else groups.push({ module: p.module, perms: [p] })
    }
    return groups
  }, [perms])

  const has = (roleId: string, permId: string) => pending.has(`${roleId}:${permId}`)
  const isChanged = (roleId: string, permId: string) =>
    pending.has(`${roleId}:${permId}`) !== baseline.has(`${roleId}:${permId}`)
  const toggle = (roleId: string, permId: string) => {
    const key = `${roleId}:${permId}`
    setPending((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const discard = () => {
    setPending(new Set(baseline))
    setError(null)
  }

  async function save() {
    setSaving(true)
    setError(null)
    // one atomic RPC: the whole batch commits or rolls back together — a
    // half-applied matrix is impossible, and the DB's last-admin guard sees the
    // true net state (adds run before removes there)
    const res = await core().rpc('apply_role_permissions', { p_adds: adds, p_removes: removes })
    if (res.error) {
      setError(res.error.message) // nothing persisted (atomic) — keep edits for a one-tap retry
      setSaving(false)
      return
    }
    // own grants may have just changed — refresh the UI mirror alongside the reload
    await Promise.all([load(), refreshPermissions()])
    setSaving(false)
  }

  return {
    roles, perms, moduleGroups, loading, error, saving, dirtyCount,
    has, isChanged, toggle, discard, save, load,
  }
}

/** Per-module accordion shell shared by both permission views. Each module folds
 *  by itself at every width; `renderControls` fills each permission row's control
 *  area (role chips for the matrix, a single toggle for the by-role view).
 *  `renderBadge` sets the count shown on the module header — total permissions
 *  for the matrix, or granted/total for the by-role view. */
function PermAccordion({
  groups,
  renderControls,
  renderBadge,
}: {
  groups: { module: string; perms: PermissionRow[] }[]
  renderControls: (p: PermissionRow) => ReactNode
  renderBadge?: (g: { module: string; perms: PermissionRow[] }) => ReactNode
}) {
  const ut = useUT()
  return (
    <div className="u-matrix-acc">
      {groups.map((g) => (
        <details key={g.module} className="card u-permacc">
          <summary className="u-permacc-sum">
            <span className="u-permacc-title">{ut.moduleNames[g.module] ?? g.module}</span>
            <span className="badge">{renderBadge ? renderBadge(g) : g.perms.length}</span>
          </summary>
          <div className="u-permacc-body">
            {g.perms.map((p) => (
              <div key={p.id} className="u-accperm">
                <div className="u-accperm-info">
                  <code className="u-permkey">{p.key}</code>
                  <span className="u-permlabel">{p.label}</span>
                </div>
                <div className="u-accperm-ctrl">{renderControls(p)}</div>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  )
}

/** Sticky Save/Discard bar — shared, thumb-reachable, shown only when dirty. */
function SaveBar({
  dirtyCount,
  saving,
  onSave,
  onDiscard,
}: {
  dirtyCount: number
  saving: boolean
  onSave: () => void
  onDiscard: () => void
}) {
  const ut = useUT()
  if (dirtyCount === 0) return null
  return (
    <div className="u-savebar card">
      <span>
        {ut.pendingChanges} {dirtyCount}
      </span>
      <div className="u-actions">
        <button type="button" className="btn-primary" disabled={saving} onClick={onSave}>
          {saving ? ut.saving : ut.save}
        </button>
        <button type="button" className="btn-ghost" disabled={saving} onClick={onDiscard}>
          {ut.discard}
        </button>
      </div>
    </div>
  )
}

/** All-roles matrix: every module folds by itself (at all widths); each permission
 *  row carries a toggle chip per role. */
function MatrixTab({ canManage }: { canManage: boolean }) {
  const ut = useUT()
  const roleName = useRoleName()
  const m = usePermissionMatrix()

  if (m.loading && m.roles.length === 0) return <div className="muted">{ut.loadingPermissions}</div>
  if (m.error && m.roles.length === 0) return <ErrorNotice error={m.error} />

  return (
    <div>
      {m.error && <ErrorNotice error={m.error} />}
      {canManage && <RolesManager roles={m.roles} onChanged={m.load} locked={m.dirtyCount > 0} />}

      <PermAccordion
        groups={m.moduleGroups}
        renderControls={(p) => (
          <div className="chips">
            {m.roles.map((r) => {
              const checked = m.has(r.id, p.id)
              return (
                <button
                  key={r.id}
                  type="button"
                  className={(checked ? 'chip on' : 'chip') + (m.isChanged(r.id, p.id) ? ' u-chip-dirty' : '')}
                  aria-pressed={checked}
                  disabled={!canManage || m.saving}
                  onClick={() => m.toggle(r.id, p.id)}
                >
                  {roleName(r)}
                </button>
              )
            })}
          </div>
        )}
      />

      {canManage && (
        <SaveBar dirtyCount={m.dirtyCount} saving={m.saving} onSave={m.save} onDiscard={m.discard} />
      )}
    </div>
  )
}

/** By-role view: pick a role, then view AND edit its permissions as per-module
 *  accordions. Shares the matrix's edit/Save engine, so edits here and in the
 *  all-roles tab commit through the same atomic RPC. */
function ByRoleTab({ canManage }: { canManage: boolean }) {
  const ut = useUT()
  const roleName = useRoleName()
  const m = usePermissionMatrix()
  const [roleId, setRoleId] = useState('')
  // the members list needs the user roster (permission catalog doesn't carry it)
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  useEffect(() => {
    let live = true
    void core()
      .rpc('admin_list_users')
      .then(({ data, error }) => {
        if (!live) return
        // degrade to an empty roster on error rather than spinning forever;
        // this RPC needs users.view, which the tab already required to render
        if (error) console.error('by-role: admin_list_users failed:', error.message)
        setUsers((data as AdminUser[] | null) ?? [])
      })
    return () => {
      live = false
    }
  }, [])
  // default to the first role once loaded; keep the user's pick otherwise
  useEffect(() => {
    if (!roleId && m.roles.length > 0) setRoleId(m.roles[0].id)
  }, [m.roles, roleId])
  const selected = m.roles.find((r) => r.id === roleId) ?? null

  if (m.loading && m.roles.length === 0) return <div className="muted">{ut.loadingPermissions}</div>
  if (m.error && m.roles.length === 0) return <ErrorNotice error={m.error} />

  return (
    <div>
      {m.error && <ErrorNotice error={m.error} />}

      <div className="u-rolepick">
        <span className="u-seclabel">{ut.selectRole}</span>
        <div className="chips">
          {m.roles.map((r) => (
            <button
              key={r.id}
              type="button"
              className={r.id === roleId ? 'chip on' : 'chip'}
              aria-pressed={r.id === roleId}
              onClick={() => setRoleId(r.id)}
            >
              {roleName(r)}
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <>
          <div className="u-rolesection">
            <div className="u-seclabel">{ut.secMembers}</div>
            <RoleMembers role={selected} users={users} />
          </div>

          <div className="u-rolesection">
            <div className="u-seclabel">{ut.secPerms}</div>
            <PermAccordion
              groups={m.moduleGroups}
              renderBadge={(g) => {
                const granted = g.perms.filter((p) => m.has(selected.id, p.id)).length
                return (
                  <span className={granted > 0 ? 'u-count u-count-on' : 'u-count'}>
                    {granted}/{g.perms.length}
                  </span>
                )
              }}
              renderControls={(p) => {
                const checked = m.has(selected.id, p.id)
                return (
                  <button
                    type="button"
                    className={
                      (checked ? 'chip on' : 'chip') +
                      ' u-permtoggle' +
                      (m.isChanged(selected.id, p.id) ? ' u-chip-dirty' : '')
                    }
                    aria-pressed={checked}
                    disabled={!canManage || m.saving}
                    onClick={() => m.toggle(selected.id, p.id)}
                  >
                    {checked ? ut.permAllowed : ut.permBlocked}
                  </button>
                )
              }}
            />
          </div>
        </>
      )}

      {canManage && (
        <SaveBar dirtyCount={m.dirtyCount} saving={m.saving} onSave={m.save} onDiscard={m.discard} />
      )}
    </div>
  )
}

/** Users holding the selected role, with a search box — a searchable accordion
 *  in the by-role tab (who's in this role right now). */
function RoleMembers({ role, users }: { role: RoleRow; users: AdminUser[] | null }) {
  const ut = useUT()
  const [q, setQ] = useState('')
  const members = useMemo(
    () => (users ?? []).filter((u) => u.roles.includes(role.key)),
    [users, role.key],
  )
  const needle = q.trim().toLowerCase()
  const shown = needle
    ? members.filter((u) => (u.email ?? u.user_id).toLowerCase().includes(needle))
    : members

  return (
    <details className="card u-permacc">
      <summary className="u-permacc-sum">
        <span className="u-permacc-title">{ut.usersWithRole}</span>
        <span className="badge">{members.length}</span>
      </summary>
      <div className="u-permacc-body">
        {users === null ? (
          <p className="muted u-emptyline">{ut.loadingUsers}</p>
        ) : members.length === 0 ? (
          <p className="muted u-emptyline">{ut.noMembers}</p>
        ) : (
          <>
            <input
              className="u-search"
              type="search"
              placeholder={ut.searchUser}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {shown.length === 0 ? (
              <p className="muted u-emptyline">{ut.noMatch}</p>
            ) : (
              <div className="u-memberlist">
                {shown.map((u) => (
                  <div key={u.user_id} className="u-member">
                    <span className="u-avatar u-avatar-sm" aria-hidden="true">
                      {initials(u.email, u.user_id)}
                    </span>
                    <span className="u-member-mail">{u.email ?? u.user_id}</span>
                    {isDeactivated(u) && <span className="u-membertag">{ut.userDeactivated}</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </details>
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
      // the DB blocks deleting a role that's still assigned to users
      setError(res.error.message.includes('role_in_use') ? ut.roleInUse : res.error.message)
      return
    }
    await onChanged()
  }

  return (
    <div className="u-rolesmgr">
      <div className="u-seclabel">{ut.secRoles}</div>
      <div className="u-rolelist">
        {roles.map((r) => (
          <span key={r.id} className="u-rolechip">
            <span className="u-rolechip-name">{roleName(r)}</span>
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
          <button type="button" className="u-roleadd" disabled={busy || locked} onClick={openNew}>
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
