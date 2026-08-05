import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { finance } from '../../lib/supabase'
import type { FinanceExpected, FinanceKind, FinancePaymentMethod } from '../../types'
import { useRowDisclosure } from '../../lib/useRowDisclosure'
import { PAYMENT_METHODS, useCategoryName } from './categories'
import DateField from './DateField'
import ErrorNotice from './ErrorNotice'
import { shortDate, todayStr } from './format'
import { useFT, type FinanceDict } from './i18n'
import { sourceHref } from './provenance'
import SourceBadge from './SourceBadge'

function expectedTitle(
  ft: FinanceDict,
  categoryName: (kind: FinanceKind, key: string) => string,
  r: FinanceExpected,
) {
  // direction is the expectation's income/expense sense — the categories table
  // is keyed by kind, so map it before looking the label up
  const kind: FinanceKind = r.direction === 'in' ? 'income' : 'expense'
  return ft.reasonLabels[r.reason] ?? (r.reason || categoryName(kind, r.category))
}

type FulfillValues = {
  amount: number
  payment_method: FinancePaymentMethod
  date: string
  note: string
}

export default function ExpectedTab({
  canManage,
  onMoneyChanged,
  focusId,
  onFocusHandled,
}: {
  canManage: boolean
  /** an expectation the user was sent to from the Reconcile tab: scroll to it
   *  and mark it, so "go record the payment" lands on the right row instead of
   *  dropping them into a list to search again */
  focusId?: string | null
  onFocusHandled?: () => void
  /** fulfilling or cancelling an expectation changes the overdue drift check,
   *  so the module's reconciliation read has to be refreshed — otherwise the
   *  banner and the Reconcile tab keep showing the pre-change count */
  onMoneyChanged: () => void
}) {
  const ft = useFT()
  const categoryName = useCategoryName()
  const { rowProps } = useRowDisclosure()
  const [rows, setRows] = useState<FinanceExpected[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const [fulfillId, setFulfillId] = useState<string | null>(null)
  const focusRef = useRef<HTMLTableRowElement | null>(null)

  // Scroll the focused row into view once the list has rendered, then hand the
  // focus back so it does not re-fire on every later render of this tab.
  useEffect(() => {
    if (!focusId || loading) return
    focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(() => onFocusHandled?.(), 2500)
    return () => clearTimeout(t)
  }, [focusId, loading, onFocusHandled])

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await finance()
      .from('expected')
      .select('*')
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (error) {
      setError(error.message)
    } else {
      setRows((data as FinanceExpected[] | null) ?? [])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const open = rows.filter((r) => r.status === 'open')
  const closed = rows.filter((r) => r.status !== 'open')
  const today = todayStr()
  let openIn = 0
  let openOut = 0
  for (const r of open) {
    if (r.direction === 'in') openIn += Number(r.amount)
    else openOut += Number(r.amount)
  }
  // open-only lookup: a cancelled/fulfilled row closes its form on the next render
  const fulfillRow = fulfillId ? open.find((r) => r.id === fulfillId) : undefined

  async function submitFulfill(r: FinanceExpected, v: FulfillValues) {
    setBusy(true)
    const { error } = await finance().rpc('record_payment', {
      p_expected: r.id,
      p_amount: v.amount,
      p_method: v.payment_method,
      p_date: v.date,
      p_note: v.note.trim() || null,
    })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setFulfillId(null)
    setError(null)
    await load()
    onMoneyChanged()
  }

  async function cancel(r: FinanceExpected) {
    if (!window.confirm(ft.confirmCancelExpected)) return
    setBusy(true)
    const { data, error } = await finance()
      .from('expected')
      .update({ status: 'cancelled' })
      .eq('id', r.id)
      .eq('status', 'open')
      .select('id')
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    // PostgREST answers 200 with zero rows when RLS filters the write out — treat as denial
    if (!data || data.length === 0) {
      setError(ft.cancelDenied)
      return
    }
    await load()
    onMoneyChanged()
  }

  function renderRow(r: FinanceExpected) {
    const overdue = r.status === 'open' && !!r.due_date && r.due_date < today
    return (
      <tr
        key={r.id}
        ref={r.id === focusId ? focusRef : undefined}
        className={r.id === focusId ? 'finance-row-focus' : undefined}
        {...rowProps(r.id)}
      >
        <td className="rl-lead" title={r.due_date ?? undefined}>
          {r.due_date ? shortDate(r.due_date) : '—'}
          {overdue && <span className="finance-badge finance-badge-warn">{ft.overdue}</span>}
        </td>
        <td
          className={`rl-more ${r.direction === 'in' ? 'finance-income' : 'finance-expense'}`}
          data-label={ft.colDirection}
        >
          {r.direction === 'in' ? ft.expectedIn : ft.expectedOut}
        </td>
        <td className="rl-main">
          {expectedTitle(ft, categoryName, r)}
          <SourceBadge
            module={r.source_module}
            sourceRef={r.source_ref}
            href={sourceHref(r.source_module, r.source_ref)}
          />
        </td>
        <td
          className={`rl-amt finance-amount ${r.direction === 'in' ? 'finance-income' : 'finance-expense'}`}
        >
          <span dir="ltr">{Number(r.amount).toLocaleString('he-IL')} ₪</span>
        </td>
        <td className="rl-more" data-label={ft.colStatus}>
          {ft.statusLabels[r.status]}
        </td>
        <td className="rl-more muted" data-label={ft.colNote}>
          {r.note}
        </td>
        {canManage && (
          <td className="rl-actions">
            {r.status === 'open' && (
              <>
                <button
                  className="btn-ghost btn-sm btn-icon-label"
                  disabled={busy}
                  onClick={() => setFulfillId((id) => (id === r.id ? null : r.id))}
                >
                  <span aria-hidden="true">₪</span>
                  <span className="btn-label">{ft.recordPayment}</span>
                </button>
                <button
                  className="btn-ghost btn-sm btn-icon-label"
                  disabled={busy}
                  onClick={() => cancel(r)}
                  aria-label={ft.cancelExpected}
                >
                  <span aria-hidden="true">✕</span>
                  <span className="btn-label">{ft.cancelExpected}</span>
                </button>
              </>
            )}
          </td>
        )}
      </tr>
    )
  }

  return (
    <div>
      <div className="finance-summary">
        <div className="card finance-stat stat-income">
          <span className="muted">{ft.openExpectedIn}</span>
          <strong className="finance-income">{openIn.toLocaleString('he-IL')} ₪</strong>
        </div>
        <div className="card finance-stat stat-expense">
          <span className="muted">{ft.openExpectedOut}</span>
          <strong className="finance-expense">{openOut.toLocaleString('he-IL')} ₪</strong>
        </div>
      </div>

      {error && <ErrorNotice error={error} />}

      {loading ? (
        <div className="muted">{ft.loadingExpected}</div>
      ) : (
        <div className="card rowline">
          <table className="grid">
            <thead>
              <tr>
                <th>{ft.colDue}</th>
                <th>{ft.colDirection}</th>
                <th>{ft.colFor}</th>
                <th>{ft.colAmount}</th>
                <th>{ft.colStatus}</th>
                <th>{ft.colNote}</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {open.map((r) => (
                <Fragment key={r.id}>
                  {renderRow(r)}
                  {/* the record-payment form opens right under its row, in context */}
                  {canManage && fulfillRow?.id === r.id && (
                    <tr className="rl-formrow">
                      <td colSpan={7}>
                        <FulfillForm
                          key={fulfillRow.id}
                          row={fulfillRow}
                          busy={busy}
                          onSubmit={(v) => submitFulfill(fulfillRow, v)}
                          onCancel={() => setFulfillId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {open.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="muted">
                    {ft.noOpenExpected}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {closed.length > 0 && (
            <div className="finance-load-more">
              <button className="btn-ghost" onClick={() => setShowClosed((v) => !v)}>
                {showClosed ? ft.hideHistory : `${ft.history} (${closed.length})`}
              </button>
            </div>
          )}
          {showClosed && (
            <table className="grid">
              <tbody>{closed.map(renderRow)}</tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// Owns its form state so keystrokes don't re-render the whole expected table.
function FulfillForm({
  row,
  busy,
  onSubmit,
  onCancel,
}: {
  row: FinanceExpected
  busy: boolean
  onSubmit: (v: FulfillValues) => void
  onCancel: () => void
}) {
  const ft = useFT()
  const categoryName = useCategoryName()
  const [amount, setAmount] = useState(String(row.amount))
  const [method, setMethod] = useState<FinancePaymentMethod>('cash')
  const [date, setDate] = useState(todayStr())
  const [note, setNote] = useState('')
  const [invalid, setInvalid] = useState(false)

  function submit() {
    const n = Number(amount)
    if (!n || n <= 0) {
      setInvalid(true)
      return
    }
    // record_payment closes the expectation whatever the amount — a partial
    // payment must be a conscious choice (full partial-payment support is a
    // roadmap follow-up)
    if (
      n !== Number(row.amount) &&
      !window.confirm(ft.amountDiffers(Number(row.amount).toLocaleString('he-IL')))
    )
      return
    setInvalid(false)
    onSubmit({ amount: n, payment_method: method, date, note })
  }

  return (
    <div className="finance-form finance-fulfill">
      <div className="muted">
        {ft.recordPaymentTitle} — {expectedTitle(ft, categoryName, row)} (
        <span dir="ltr">{Number(row.amount).toLocaleString('he-IL')} ₪</span> {ft.expectedSuffix})
      </div>
      {invalid && <div className="error">{ft.invalidAmount}</div>}
      <div className="field-row">
        <label className="field">
          <span className="field-label">{ft.amountShekel}</span>
          <input
            type="number"
            dir="ltr"
            inputMode="decimal"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">{ft.date}</span>
          <DateField value={date} onChange={setDate} />
        </label>
      </div>
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
      <label className="field">
        <span className="field-label">{ft.noteOptional}</span>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="field-actions">
        <button className="btn-primary btn-block" disabled={busy} onClick={submit}>
          {ft.submitPayment}
        </button>
        <button className="btn-ghost" disabled={busy} onClick={onCancel}>
          {ft.cancel}
        </button>
      </div>
    </div>
  )
}
