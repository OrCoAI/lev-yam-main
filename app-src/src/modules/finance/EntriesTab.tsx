import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { finance } from '../../lib/supabase'
import type { FinanceCategory, FinanceEntry, FinanceKind, FinancePaymentMethod } from '../../types'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from './categories'
import { useRowDisclosure } from '../../lib/useRowDisclosure'
import DateField from './DateField'
import { shortDate, signedAmount, todayStr } from './format'
import { useFT } from './i18n'
import KindFilterChips, { type KindFilter } from './KindFilterChips'
import { sourceHref, useQuoteMap } from './provenance'
import SourceBadge from './SourceBadge'

const PAGE_SIZE = 100

type EntryPayload = {
  kind: FinanceKind
  category: FinanceCategory
  payment_method: FinancePaymentMethod
  amount: number
  entry_date: string
  note: string | null
}

function categoriesFor(kind: FinanceKind): FinanceCategory[] {
  return kind === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
}

export default function EntriesTab({ canManage }: { canManage: boolean }) {
  const ft = useFT()
  const { isPhone, rowProps } = useRowDisclosure()
  const [entries, setEntries] = useState<FinanceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<FinanceEntry | null>(null)
  // remounts EntryForm after a successful insert — the fields must not keep
  // their just-saved values (a second submit would duplicate the entry)
  const [formEpoch, setFormEpoch] = useState(0)
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const quoteMap = useQuoteMap(entries)
  // on phones the form starts collapsed behind a button so the list leads
  const [formOpen, setFormOpen] = useState(!isPhone)
  useEffect(() => {
    // viewport mode changed (rotation/resize): reset to that mode's default,
    // unless an edit is in progress — never yank an open edit away
    if (!editing) setFormOpen(!isPhone)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPhone])

  const loadIdRef = useRef(0)
  const offsetRef = useRef(0)

  const load = useCallback(
    async (append = false) => {
      const id = ++loadIdRef.current
      if (append) setLoadingMore(true)
      else {
        setLoading(true)
        offsetRef.current = 0
      }
      const offset = append ? offsetRef.current : 0
      let query = finance().from('entries').select('*')
      if (kindFilter !== 'all') query = query.eq('kind', kindFilter)
      const { data, error } = await query
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)
      if (id !== loadIdRef.current) return // a newer load superseded this one
      if (error) {
        setError(error.message)
      } else {
        const rows = (data as FinanceEntry[] | null) ?? []
        setEntries((prev) => (append ? [...prev, ...rows] : rows))
        offsetRef.current = offset + rows.length
        setHasMore(rows.length === PAGE_SIZE)
        setError(null)
      }
      setLoading(false)
      setLoadingMore(false)
    },
    [kindFilter],
  )

  useEffect(() => {
    void load()
  }, [load])

  function startEdit(e: FinanceEntry) {
    setEditing(e)
    setFormOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditing(null)
    setError(null)
  }

  async function save(payload: EntryPayload) {
    setBusy(true)
    const res = editing
      ? await finance().from('entries').update(payload).eq('id', editing.id)
      : await finance().from('entries').insert(payload)
    setBusy(false)
    if (res.error) {
      setError(res.error.message)
      return
    }
    cancelEdit()
    setFormEpoch((n) => n + 1)
    if (isPhone) setFormOpen(false) // land back on the list — the saved row is the feedback
    await load()
  }

  async function remove(id: string) {
    if (!window.confirm(ft.confirmDelete)) return
    setBusy(true)
    const { error } = await finance().from('entries').delete().eq('id', id)
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    if (editing?.id === id) cancelEdit()
    await load()
  }

  return (
    <div>
      {canManage && !formOpen && (
        <button className="btn-primary form-open-btn" onClick={() => setFormOpen(true)}>
          + {ft.addEntry}
        </button>
      )}
      {canManage && formOpen && (
        <EntryForm
          key={editing?.id ?? `new-${formEpoch}`}
          initial={editing}
          busy={busy}
          onSubmit={save}
          onCancelEdit={cancelEdit}
          onClose={!editing && isPhone ? () => setFormOpen(false) : undefined}
        />
      )}

      <KindFilterChips value={kindFilter} onChange={setKindFilter} />

      {error && (
        <div className="error">
          {ft.errorPrefix} {error}
        </div>
      )}

      {loading ? (
        <div className="muted">{ft.loadingEntries}</div>
      ) : (
        <div className="card rowline">
          <table className="grid">
            <thead>
              <tr>
                <th>{ft.colDate}</th>
                <th>{ft.colKind}</th>
                <th>{ft.colCategory}</th>
                <th>{ft.colPayment}</th>
                <th>{ft.colAmount}</th>
                <th>{ft.colNote}</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const href = sourceHref(e.source_module, e.source_ref, quoteMap)
                return (
                  <tr key={e.id} {...rowProps(e.id)}>
                    <td className="rl-lead" title={e.entry_date}>
                      {shortDate(e.entry_date)}
                    </td>
                    <td
                      className={`rl-more ${e.kind === 'income' ? 'finance-income' : 'finance-expense'}`}
                      data-label={ft.colKind}
                    >
                      {e.kind === 'income' ? ft.income : ft.expense}
                    </td>
                    <td className="rl-main">
                      {ft.categoryLabels[e.category] ?? e.category}
                      <SourceBadge module={e.source_module} sourceRef={e.source_ref} href={href} />
                    </td>
                    <td className="rl-more" data-label={ft.colPayment}>
                      {e.payment_method ? ft.paymentLabels[e.payment_method] : '—'}
                    </td>
                    <td className={`rl-amt finance-amount ${e.kind === 'income' ? 'finance-income' : 'finance-expense'}`}>
                      <span dir="ltr">{signedAmount(e.kind, e.amount)}</span>
                    </td>
                    <td className="rl-more muted" data-label={ft.colNote}>
                      {e.note ?? ''}
                    </td>
                    {canManage && (
                      <td className="rl-actions">
                        {/* module-posted rows are immutable (DB guard) — corrections are
                            reversals posted by the source module, so no edit/delete here */}
                        {!e.source_module ? (
                          <>
                            <button
                              className="btn-ghost btn-sm btn-icon-label"
                              disabled={busy}
                              onClick={() => startEdit(e)}
                              aria-label={ft.edit}
                            >
                              <span aria-hidden="true">✎</span>
                              <span className="btn-label">{ft.edit}</span>
                            </button>
                            <button
                              className="btn-ghost btn-sm btn-icon-label"
                              disabled={busy}
                              onClick={() => remove(e.id)}
                              aria-label={ft.delete}
                            >
                              <span aria-hidden="true">✕</span>
                              <span className="btn-label">{ft.delete}</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="rl-lock">{ft.lockedByModule}</span>
                            {href && (
                              <Link
                                className="btn-ghost btn-sm btn-icon-label"
                                to={href}
                                aria-label={ft.openSource}
                              >
                                <span aria-hidden="true">↗</span>
                                <span className="btn-label">{ft.openSource}</span>
                              </Link>
                            )}
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="muted">
                    {kindFilter === 'all' ? ft.noEntries : ft.noEntriesFiltered}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {hasMore && (
            <div className="finance-load-more">
              <button className="btn-ghost" disabled={loadingMore} onClick={() => load(true)}>
                {loadingMore ? ft.loading : ft.loadMore}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Owns its field state so keystrokes don't re-render the entries table
// (same pattern as ExpectedTab's FulfillForm). Remounted via key on edit.
function EntryForm({
  initial,
  busy,
  onSubmit,
  onCancelEdit,
  onClose,
}: {
  initial: FinanceEntry | null
  busy: boolean
  onSubmit: (payload: EntryPayload) => void
  onCancelEdit: () => void
  onClose?: () => void
}) {
  const ft = useFT()
  const [kind, setKind] = useState<FinanceKind>(initial?.kind ?? 'expense')
  const [category, setCategory] = useState<FinanceCategory>(
    initial?.category ?? EXPENSE_CATEGORIES[0],
  )
  const [method, setMethod] = useState<FinancePaymentMethod>(initial?.payment_method ?? 'cash')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [entryDate, setEntryDate] = useState(initial?.entry_date ?? todayStr())
  const [note, setNote] = useState(initial?.note ?? '')
  const [invalid, setInvalid] = useState(false)

  function changeKind(next: FinanceKind) {
    setKind(next)
    setCategory(categoriesFor(next)[0])
  }

  function submit() {
    const n = Number(amount)
    if (!n || n <= 0) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    onSubmit({
      kind,
      category,
      payment_method: method,
      amount: n,
      entry_date: entryDate,
      note: note.trim() || null,
    })
  }

  return (
    <div className="card finance-form">
      {/* income / expense */}
      <div className="seg seg-2">
        <button
          type="button"
          className={kind === 'expense' ? 'seg-btn on' : 'seg-btn'}
          onClick={() => changeKind('expense')}
        >
          {ft.expense}
        </button>
        <button
          type="button"
          className={kind === 'income' ? 'seg-btn on income' : 'seg-btn'}
          onClick={() => changeKind('income')}
        >
          {ft.income}
        </button>
      </div>

      <label className="field">
        <span className="field-label">{ft.category}</span>
        <select value={category} onChange={(e) => setCategory(e.target.value as FinanceCategory)}>
          {/* editing a legacy row whose category is now derived-only keeps its option */}
          {!categoriesFor(kind).includes(category) && (
            <option value={category}>{ft.categoryLabels[category] ?? category}</option>
          )}
          {categoriesFor(kind).map((c) => (
            <option key={c} value={c}>
              {ft.categoryLabels[c]}
            </option>
          ))}
        </select>
      </label>

      <div className="field">
        <span className="field-label">{ft.paymentMethod}</span>
        <div className="chips chips-grid">
          {PAYMENT_METHODS.map((p) => (
            <button
              key={p}
              type="button"
              className={method === p ? 'chip on' : 'chip'}
              onClick={() => setMethod(p)}
            >
              {ft.paymentLabels[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="field-row">
        <label className="field">
          <span className="field-label">{ft.amountShekel}</span>
          <input
            type="number"
            dir="ltr"
            inputMode="decimal"
            step="0.01"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">{ft.date}</span>
          <DateField value={entryDate} onChange={setEntryDate} />
        </label>
      </div>

      <label className="field">
        <span className="field-label">{ft.noteOptional}</span>
        <input
          type="text"
          placeholder={ft.notePlaceholder}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      {invalid && <div className="error">{ft.invalidAmount}</div>}

      <div className="field-actions">
        <button
          className={`btn-primary btn-block ${kind === 'income' ? 'btn-income' : 'btn-expense'}`}
          disabled={busy}
          onClick={submit}
        >
          {initial ? ft.updateEntry : ft.submitEntry}
        </button>
        {initial && (
          <button className="btn-ghost" disabled={busy} onClick={onCancelEdit}>
            {ft.cancel}
          </button>
        )}
        {onClose && (
          <button className="btn-ghost" disabled={busy} onClick={onClose}>
            {ft.closeForm}
          </button>
        )}
      </div>
    </div>
  )
}
