import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { finance } from '../../lib/supabase'
import type { FinanceExpected, FinanceKind, FinancePaymentMethod } from '../../types'
import { useRowDisclosure } from '../../lib/useRowDisclosure'
import { PAYMENT_METHODS, useCategoryName } from './categories'
import DateField from './DateField'
import ErrorNotice from './ErrorNotice'
import { amount as fmtAmount, shortDate, todayStr } from './format'
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
  // Required by the server whenever amount exceeds the remainder; stamped
  // into the posted entry's note so the books say why the extra is there.
  overReason: string | null
}

// What is still OWED on a row. The `?? 0` matters: prod may not have the
// column until the SQL is hand-applied (see types.ts), and a NaN here would
// poison every sum and default it feeds.
function outstanding(r: FinanceExpected) {
  return Number(r.amount) - Number(r.paid_amount ?? 0)
}

// The "paid X of Y" sub-line, shared by the open row and the fulfil form.
// The i18n template appends ₪ itself, so these stay bare locale numbers.
function paidOfLabel(ft: FinanceDict, r: FinanceExpected) {
  return ft.paidOf(
    Number(r.paid_amount ?? 0).toLocaleString('he-IL'),
    Number(r.amount).toLocaleString('he-IL'),
  )
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
    // Counting the full amount would overstate the open plan by everything
    // already collected against part-paid rows.
    if (r.direction === 'in') openIn += outstanding(r)
    else openOut += outstanding(r)
  }
  // open-only lookup: a cancelled/fulfilled row closes its form on the next render
  const fulfillRow = fulfillId ? open.find((r) => r.id === fulfillId) : undefined

  async function submitFulfill(r: FinanceExpected, v: FulfillValues) {
    setBusy(true)
    // p_over_reason is only sent when overpaying: PostgREST matches an RPC by
    // its named-argument set, so an always-present extra argument would match
    // NOTHING against a database still running the previous 5-parameter
    // record_payment — and /app auto-deploys before the SQL is hand-applied to
    // prod (the same skew window that makes types.ts's paid_amount optional).
    const args: {
      p_expected: string
      p_amount: number
      p_method: FinancePaymentMethod
      p_date: string
      p_note: string | null
      p_over_reason?: string
    } = {
      p_expected: r.id,
      p_amount: v.amount,
      p_method: v.payment_method,
      p_date: v.date,
      p_note: v.note.trim() || null,
    }
    if (v.overReason) args.p_over_reason = v.overReason
    const { error } = await finance().rpc('record_payment', args)
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
          <span dir="ltr">{fmtAmount(r.status === 'open' ? outstanding(r) : Number(r.amount))}</span>
          {Number(r.paid_amount ?? 0) > 0 && r.status === 'open' && (
            <div className="muted" style={{ fontSize: '0.78rem', fontWeight: 400 }}>
              {paidOfLabel(ft, r)}
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
          <strong className="finance-income">{fmtAmount(openIn)}</strong>
        </div>
        <div className="card finance-stat stat-expense">
          <span className="muted">{ft.openExpectedOut}</span>
          <strong className="finance-expense">{fmtAmount(openOut)}</strong>
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
  const remaining = outstanding(row)
  const [amount, setAmount] = useState(String(remaining))
  const [method, setMethod] = useState<FinancePaymentMethod>('cash')
  const [date, setDate] = useState(todayStr())
  const [note, setNote] = useState('')
  const [overReason, setOverReason] = useState('')
  const [submitError, setSubmitError] = useState<'invalid' | 'reasonMissing' | null>(null)
  // Reactive, not submit-time: the reason box appears the moment the typed
  // amount exceeds the remainder, so the requirement is visible before the
  // user reaches the submit button. The server enforces the same rule.
  // Compared at 2 decimals, matching the server's numeric(12,2): the raw float
  // subtraction behind `remaining` can sit a hair off the true value, which
  // would demand a reason for an exact-remainder payment (or skip the box for
  // an amount the server then refuses without one).
  const isOver = Math.round(Number(amount) * 100) > Math.round(remaining * 100)

  function submit() {
    const n = Number(amount)
    if (!n || n <= 0) {
      setSubmitError('invalid')
      return
    }
    if (isOver && !overReason.trim()) {
      setSubmitError('reasonMissing')
      return
    }
    setSubmitError(null)
    onSubmit({
      amount: n,
      payment_method: method,
      date,
      note,
      overReason: isOver ? overReason.trim() : null,
    })
  }

  return (
    <div className="finance-form finance-fulfill">
      <div className="muted">
        {ft.recordPaymentTitle} — {expectedTitle(ft, categoryName, row)} (
        <span dir="ltr">{fmtAmount(Number(row.amount))}</span> {ft.expectedSuffix})
      </div>
      {Number(row.paid_amount ?? 0) > 0 && (
        <div className="muted">
          {paidOfLabel(ft, row)} · {ft.remainingToPay}:{' '}
          <span dir="ltr">{fmtAmount(remaining)}</span>
        </div>
      )}
      {submitError === 'invalid' && <div className="error">{ft.invalidAmount}</div>}
      {isOver && (
        <div className={submitError === 'reasonMissing' ? 'error' : 'muted'}>
          {ft.overpayNotice(remaining.toLocaleString('he-IL'))}
        </div>
      )}
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
      {isOver && (
        <label className="field">
          <span className="field-label">{ft.overpayReasonLabel}</span>
          <input
            type="text"
            value={overReason}
            onChange={(e) => setOverReason(e.target.value)}
          />
        </label>
      )}
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
