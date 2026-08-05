// Owner-only admin for the category taxonomy (finance.categories permission).
// The DB is the guard: RLS gates writes on finance.categories, column-level
// grants make `kind`/`key`/`owned_by_module` unwritable from here, and the FKs
// from entries/expected refuse to let an in-use category be deleted — which is
// why this UI archives instead of deleting.
import { useMemo, useState } from 'react'
import { pickDbLabel, useI18n } from '../../lib/i18n'
import { finance } from '../../lib/supabase'
import type { FinanceCategoryRow, FinanceKind } from '../../types'
import { useCategories } from './categories'
import ErrorNotice from './ErrorNotice'
import { useFT } from './i18n'

const KEY_RE = /^[a-z][a-z0-9_]*$/

type Draft = { key: string; label_he: string; label_ar: string }

const EMPTY: Draft = { key: '', label_he: '', label_ar: '' }

export default function CategoriesTab() {
  const ft = useFT()
  const { rows, loading, error, reload } = useCategories()
  const [kind, setKind] = useState<FinanceKind>('expense')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [adding, setAdding] = useState(false)

  const shown = useMemo(
    () => rows.filter((c) => c.kind === kind),
    [rows, kind],
  )

  async function run(action: () => Promise<{ error: { message: string } | null }>) {
    setBusy(true)
    setSaveError(null)
    const { error: err } = await action()
    if (err) setSaveError(`${ft.catSaveFailed} (${err.message})`)
    else await reload()
    setBusy(false)
    return !err
  }

  async function addCategory() {
    const key = draft.key.trim()
    const he = draft.label_he.trim()
    const ar = draft.label_ar.trim()
    if (!KEY_RE.test(key)) return setFormError(ft.catKeyInvalid)
    if (!he || !ar) return setFormError(ft.catLabelsRequired)
    if (rows.some((c) => c.kind === kind && c.key === key)) return setFormError(ft.catKeyTaken)
    setFormError(null)

    const maxSort = shown.reduce((m, c) => Math.max(m, c.sort), 0)
    const ok = await run(async () =>
      finance()
        .from('categories')
        .insert({
          kind,
          key,
          label_he: he,
          label_ar: ar,
          sort: maxSort + 10,
        }),
    )
    if (ok) {
      setDraft(EMPTY)
      setAdding(false)
    }
  }

  function patch(id: string, values: Partial<FinanceCategoryRow>) {
    return run(async () => finance().from('categories').update(values).eq('id', id))
  }

  return (
    <div>
      <p className="notice">{ft.catIntro}</p>
      {error && <ErrorNotice error={error} />}
      {saveError && <div className="error">{saveError}</div>}

      <div className="seg seg-2">
        <button
          type="button"
          className={kind === 'expense' ? 'seg-btn on' : 'seg-btn'}
          onClick={() => setKind('expense')}
        >
          {ft.catKindExpense}
        </button>
        <button
          type="button"
          className={kind === 'income' ? 'seg-btn on income' : 'seg-btn'}
          onClick={() => setKind('income')}
        >
          {ft.catKindIncome}
        </button>
      </div>

      {loading ? (
        <p className="muted">{ft.catLoading}</p>
      ) : shown.length === 0 ? (
        <p className="muted">{ft.catNone}</p>
      ) : (
        <ul className="finance-cat-list">
          {shown.map((c) => (
            <CategoryRow key={c.id} row={c} busy={busy} onPatch={patch} />
          ))}
        </ul>
      )}

      {adding ? (
        <div className="card finance-form">
          {formError && <div className="error">{formError}</div>}
          <label className="field">
            <span className="field-label">{ft.catKey}</span>
            <input
              value={draft.key}
              onChange={(e) => setDraft({ ...draft, key: e.target.value })}
              dir="ltr"
              placeholder="rent"
            />
            <span className="field-hint muted">{ft.catKeyHint}</span>
          </label>
          <label className="field">
            <span className="field-label">{ft.catLabelHe}</span>
            <input
              value={draft.label_he}
              onChange={(e) => setDraft({ ...draft, label_he: e.target.value })}
              lang="he"
            />
          </label>
          <label className="field">
            <span className="field-label">{ft.catLabelAr}</span>
            <input
              value={draft.label_ar}
              onChange={(e) => setDraft({ ...draft, label_ar: e.target.value })}
              lang="ar"
            />
          </label>
          <div className="field-actions">
            <button type="button" className="btn-primary" disabled={busy} onClick={addCategory}>
              {busy ? ft.loading : ft.catAdd}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setAdding(false)
                setDraft(EMPTY)
                setFormError(null)
              }}
            >
              {ft.cancel}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
          {ft.catAdd}
        </button>
      )}
    </div>
  )
}

function CategoryRow({
  row,
  busy,
  onPatch,
}: {
  row: FinanceCategoryRow
  busy: boolean
  onPatch: (id: string, values: Partial<FinanceCategoryRow>) => Promise<boolean>
}) {
  const ft = useFT()
  const { lang } = useI18n()
  const [editing, setEditing] = useState(false)
  const [he, setHe] = useState(row.label_he)
  const [ar, setAr] = useState(row.label_ar)
  const [err, setErr] = useState<string | null>(null)

  // Cancel must RESET the drafts: they are component state that outlives the
  // editor being closed, so an abandoned edit would otherwise be silently
  // committed by the next Save on this row.
  function cancel() {
    setHe(row.label_he)
    setAr(row.label_ar)
    setErr(null)
    setEditing(false)
  }

  async function save() {
    if (!he.trim() || !ar.trim()) return setErr(ft.catLabelsRequired)
    setErr(null)
    if (await onPatch(row.id, { label_he: he.trim(), label_ar: ar.trim() })) setEditing(false)
  }

  return (
    <li className={`finance-cat-row${row.active ? '' : ' finance-cat-archived'}`}>
      <div className="finance-cat-main">
        <span className="finance-cat-label">{pickDbLabel(lang, row)}</span>
        <code className="finance-cat-key muted" dir="ltr">
          {row.key}
        </code>
        {row.owned_by_module && (
          <span className="badge" title={ft.catModuleOwnedHint}>
            {ft.catModuleOwned} {row.owned_by_module}
          </span>
        )}
        {!row.active && (
          <span className="badge badge-muted" title={ft.catArchivedHint}>
            {ft.catArchived}
          </span>
        )}
      </div>

      {editing ? (
        <div className="finance-cat-edit finance-form">
          {err && <div className="error">{err}</div>}
          <input value={he} onChange={(e) => setHe(e.target.value)} lang="he" aria-label={ft.catLabelHe} />
          <input value={ar} onChange={(e) => setAr(e.target.value)} lang="ar" aria-label={ft.catLabelAr} />
          <button type="button" className="btn-primary" disabled={busy} onClick={save}>
            {busy ? ft.loading : ft.catSave}
          </button>
          <button type="button" className="btn-ghost" onClick={cancel}>
            {ft.cancel}
          </button>
        </div>
      ) : (
        <div className="finance-cat-actions">
          {/* btn-sm: row actions are compact everywhere else in the module (the
              phone breakpoint still gives them a 44px tap target) */}
          <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(true)}>
            {ft.edit}
          </button>
          {/* Archive, never delete: the FKs from entries/expected refuse to drop a
              category history references, and archiving is what the owner actually
              wants — stop offering it, keep the books readable.
              Module-owned categories are excluded: their postings run behind the
              levyam.finance_posting GUC, which short-circuits the guard, so
              archiving one would silently keep accepting module money while the
              row claims to be archived. */}
          {!row.owned_by_module && (
            <button
              type="button"
              className="btn-ghost btn-sm"
              disabled={busy}
              onClick={() => onPatch(row.id, { active: !row.active })}
            >
              {row.active ? ft.catArchive : ft.catRestore}
            </button>
          )}
        </div>
      )}
    </li>
  )
}
