import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { finance } from '../../lib/supabase'
import { useCan, PERM } from '../../lib/permissions'
import type { FinanceCategory, FinanceEntry, FinanceKind, FinancePaymentMethod } from '../../types'
import { PAYMENT_METHODS, pickable, useCategories, useCategoryName } from './categories'
import CorrectionForm from './CorrectionForm'
import { pickDbLabel, useI18n } from '../../lib/i18n'
import { useRowDisclosure } from '../../lib/useRowDisclosure'
import DateField from './DateField'
import ErrorNotice from './ErrorNotice'
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

export default function EntriesTab({ canManage }: { canManage: boolean }) {
  const ft = useFT()
  const categoryName = useCategoryName()
  const { isPhone, rowProps } = useRowDisclosure()
  const [entries, setEntries] = useState<FinanceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<FinanceEntry | null>(null)
  const canOverride = useCan(PERM.financeOverride)
  // the entry whose total the owner is correcting (never an edit — see
  // CorrectionForm); independent of `editing`, which is the manual-row form
  const [correcting, setCorrecting] = useState<string | null>(null)
  // the actions column exists for either capability: manage edits manual rows,
  // override corrects module-posted ones
  const showActions = canManage || canOverride
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
    // `keepWindow` re-reads every page the user has already pulled in instead
    // of snapping back to the newest PAGE_SIZE. A correction posts its offset
    // row on the ORIGINAL entry's date, so on a long ledger both the corrected
    // row and the new one sit outside page 1 — resetting there makes a
    // successful correction look like it did nothing at all.
    async (append = false, keepWindow = false) => {
      const id = ++loadIdRef.current
      if (append) setLoadingMore(true)
      else {
        setLoading(true)
        if (!keepWindow) offsetRef.current = 0
      }
      const offset = append ? offsetRef.current : 0
      const limit = append || !keepWindow ? PAGE_SIZE : Math.max(offsetRef.current, PAGE_SIZE)
      let query = finance().from('entries').select('*')
      if (kindFilter !== 'all') query = query.eq('kind', kindFilter)
      const { data, error } = await query
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
      if (id !== loadIdRef.current) return // a newer load superseded this one
      if (error) {
        setError(error.message)
      } else {
        const rows = (data as FinanceEntry[] | null) ?? []
        setEntries((prev) => (append ? [...prev, ...rows] : rows))
        offsetRef.current = offset + rows.length
        // a short read means the ledger ended — compare against what was ASKED
        // for, which is the whole re-read window when keepWindow is on
        setHasMore(rows.length === limit)
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
    setCorrecting(null)
    setEditing(e)
    setFormOpen(true)
    // the edit form lives at the top of the tab; bring it into view
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // The correction form opens INLINE, directly under the row being corrected
  // (same pattern as the record-payment form in ExpectedTab). It used to render
  // at the top of the tab, which made a click on a row further down look like
  // nothing had happened and left "what is this correcting?" unanswered.
  function startCorrection(id: string) {
    setEditing(null)
    setCorrecting((cur) => (cur === id ? null : id))
  }

  function cancelEdit() {
    setEditing(null)
    setError(null)
  }

  async function save(payload: EntryPayload) {
    const wasEdit = editing !== null // cancelEdit() below clears it
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
    // an INSERT lands at the top of the list, where the form already put the
    // user; an EDIT keeps whatever page the edited row was on
    await load(false, wasEdit)
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
    await load(false, true) // the deleted row may be pages down; stay there
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

      {error && <ErrorNotice error={error} />}

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
                {showActions && <th></th>}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const href = sourceHref(e.source_module, e.source_ref, quoteMap)
                return (
                  <Fragment key={e.id}>
                  <tr {...rowProps(e.id)}>
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
                      {categoryName(e.kind, e.category)}
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
                    {showActions && (
                      <td className="rl-actions">
                        {/* module-posted rows are immutable (DB guard) — a correction is
                            an additive row, never an edit, so no edit/delete here */}
                        {!e.source_module ? (
                          canManage && (
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
                          )
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
                            {/* Only on module-posted rows: a manual row is already
                                fully editable above, and offering two ways to
                                change the same number invites picking the wrong
                                one. The owner's reach is the same either way. */}
                            {canOverride && (
                              <button
                                className="btn-ghost btn-sm btn-icon-label"
                                disabled={busy}
                                onClick={() => startCorrection(e.id)}
                                aria-label={ft.correct}
                                title={ft.correctHint}
                              >
                                <span aria-hidden="true">±</span>
                                <span className="btn-label">{ft.correct}</span>
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                  {/* the correction opens right under the row it corrects, so
                      "which number am I fixing?" is never a guess */}
                  {correcting === e.id && (
                    <tr className="rl-formrow">
                      <td colSpan={showActions ? 7 : 6}>
                        <CorrectionForm
                          entryId={e.id}
                          onCancel={() => setCorrecting(null)}
                          onDone={() => {
                            setCorrecting(null)
                            // keep the loaded window: the correction lands on
                            // the corrected row's date, not at the top
                            void load(false, true)
                          }}
                        />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                )
              })}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={showActions ? 7 : 6} className="muted">
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
  const { lang } = useI18n()
  const { rows, error: catError } = useCategories()
  const [kind, setKind] = useState<FinanceKind>(initial?.kind ?? 'expense')
  // only the user's explicit choice is state; the taxonomy loads async, so the
  // effective value falls back to the first option until then — derived, so
  // there's no effect writing state and no render pass with an empty select
  const [picked, setPicked] = useState<FinanceCategory>(initial?.category ?? '')
  const options = useMemo(() => pickable(rows, kind), [rows, kind])
  const category = picked || options[0]?.key || ''
  // an entry being edited under a category since archived or made module-owned
  // keeps its own option, so editing it never silently re-files the row
  const legacy =
    category && !options.some((c) => c.key === category)
      ? rows.find((c) => c.kind === kind && c.key === category)
      : undefined
  const [method, setMethod] = useState<FinancePaymentMethod>(initial?.payment_method ?? 'cash')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [entryDate, setEntryDate] = useState(initial?.entry_date ?? todayStr())
  const [note, setNote] = useState(initial?.note ?? '')
  const [invalid, setInvalid] = useState(false)

  function changeKind(next: FinanceKind) {
    setKind(next)
    setPicked('')
  }

  function submit() {
    const n = Number(amount)
    if (!n || n <= 0 || !category) {
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
        <select value={category} onChange={(e) => setPicked(e.target.value)}>
          {legacy !== undefined && <option value={category}>{pickDbLabel(lang, legacy)}</option>}
          {category && legacy === undefined && !options.some((c) => c.key === category) && (
            <option value={category}>{category}</option>
          )}
          {options.map((c) => (
            <option key={c.key} value={c.key}>
              {pickDbLabel(lang, c)}
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

      {/* a failed taxonomy fetch leaves the select empty; without this the only
          feedback would be the misleading "invalid amount" on submit */}
      {catError && <ErrorNotice error={catError} />}
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
