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

  // Scroll to the focused row and start its un-highlight timer TOGETHER, once
  // per focusId, and only once the list has actually rendered.
  //
  // Both halves are load-gated on purpose. An earlier split armed the 2.5s timer
  // on mount while the scroll waited for `loading`: on a slow fetch the focus was
  // cleared before the row existed, so the user got neither the scroll nor the
  // highlight — precisely the "dropped into an unsorted list" failure this prop
  // exists to prevent.
  //
  // Guarded by a ref rather than by the deps, because `loading` flips on every
  // later load() (recording a payment triggers one) and re-running would yank the
  // viewport back to a row the user has moved on from.
  const handledRef = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!focusId || loading || handledRef.current === focusId) return
    handledRef.current = focusId
    focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // deliberately NOT cleaned up on dep change: React runs cleanup on every
    // re-run, and any later load() flips `loading` — clearing a pending timer
    // there would leave the row highlighted forever. Unmount-only, below.
    timerRef.current = setTimeout(() => onFocusHandled?.(), 2500)
  }, [focusId, loading, onFocusHandled])
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

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
    // What is still OUTSTANDING. Counting the full amount would overstate the
    // open plan by everything already collected against part-paid rows.
    const outstanding = Number(r.amount) - Number(r.paid_amount ?? 0)
    if (r.direction === 'in') openIn += outstanding
    else openOut += outstanding
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
    // kicked off BEFORE awaiting the list re-read: the two reads are independent,
    // and the reconciliation scan is the slower of them (~45ms), so waiting for
    // the list first just added its round trip to the user's wait
    onMoneyChanged()
    await load()
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
    // kicked off BEFORE awaiting the list re-read: the two reads are independent,
    // and the reconciliation scan is the slower of them (~45ms), so waiting for
    // the list first just added its round trip to the user's wait
    onMoneyChanged()
    await load()
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
          {/* Open rows show what is still OWED; closed rows show what the
              expectation WAS. renderRow is shared with the history table, and
              showing the remainder there rendered every settled row as 0 ₪. */}
          <span dir="ltr">
            {(r.status === 'open'
              ? Number(r.amount) - Number(r.paid_amount ?? 0)
              : Number(r.amount)
            ).toLocaleString('he-IL')}{' '}
            ₪
          </span>
          {Number(r.paid_amount ?? 0) > 0 && r.status === 'open' && (
            <div className="muted" style={{ fontSize: '0.78rem', fontWeight: 400 }}>
              {ft.paidOf(
                Number(r.paid_amount ?? 0).toLocaleString('he-IL'),
                Number(r.amount).toLocaleString('he-IL'),
              )}
            </div>
          )}
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
  // Default to what is still OWED, not the original figure — paying a
  // part-paid deposit "in full" means paying the remainder.
  const remaining = Number(row.amount) - Number(row.paid_amount ?? 0)
  const [amount, setAmount] = useState(String(remaining))
  const [method, setMethod] = useState<FinancePaymentMethod>('cash')
  const [date, setDate] = useState(todayStr())
  const [note, setNote] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [tooMuch, setTooMuch] = useState(false)

  function submit() {
    const n = Number(amount)
    if (!n || n <= 0) {
      setInvalid(true)
      setTooMuch(false)
      return
    }
    // The server rejects this too (record_payment raises); checking here just
    // saves a round trip and points at the field. Overpaying is now an error
    // rather than the old silent "the whole expectation closes anyway".
    if (n > remaining) {
      setInvalid(false)
      setTooMuch(true)
      return
    }
    setInvalid(false)
    setTooMuch(false)
    onSubmit({ amount: n, payment_method: method, date, note })
  }

  return (
    <div className="finance-form finance-fulfill">
      <div className="muted">
        {ft.recordPaymentTitle} — {expectedTitle(ft, categoryName, row)} (
        <span dir="ltr">{Number(row.amount).toLocaleString('he-IL')} ₪</span> {ft.expectedSuffix})
      </div>
      {Number(row.paid_amount ?? 0) > 0 && (
        <div className="muted">
          {ft.paidOf(
            Number(row.paid_amount ?? 0).toLocaleString('he-IL'),
            Number(row.amount).toLocaleString('he-IL'),
          )}{' '}
          · {ft.remainingToPay}: <span dir="ltr">{remaining.toLocaleString('he-IL')} ₪</span>
        </div>
      )}
      {invalid && <div className="error">{ft.invalidAmount}</div>}
      {tooMuch && <div className="error">{ft.overRemaining(remaining.toLocaleString('he-IL'))}</div>}
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
