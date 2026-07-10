import { useCallback, useEffect, useState } from 'react'
import { finance } from '../../lib/supabase'
import type { FinanceExpected, FinancePaymentMethod } from '../../types'
import { CATEGORY_LABELS, PAYMENT_LABELS, PAYMENT_METHODS, reasonLabel } from './categories'
import DateField from './DateField'
import { shortDate, todayStr } from './format'
import SourceBadge from './SourceBadge'

const STATUS_LABELS: Record<FinanceExpected['status'], string> = {
  open: 'פתוח',
  fulfilled: 'שולם',
  cancelled: 'בוטל',
}

function expectedTitle(r: FinanceExpected) {
  return reasonLabel(r.reason) || (CATEGORY_LABELS[r.category] ?? r.category)
}

type FulfillValues = {
  amount: number
  payment_method: FinancePaymentMethod
  date: string
  note: string
}

export default function ExpectedTab({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<FinanceExpected[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const [fulfillId, setFulfillId] = useState<string | null>(null)

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
  }

  async function cancel(r: FinanceExpected) {
    if (!window.confirm('לבטל את הצפי? המסמך המקורי (הצעה/חוזה) לא מושפע.')) return
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
      setError('הביטול לא נשמר — ייתכן שאין הרשאה או שהצפי כבר טופל.')
      return
    }
    await load()
  }

  function renderRow(r: FinanceExpected) {
    const overdue = r.status === 'open' && !!r.due_date && r.due_date < today
    return (
      <tr key={r.id}>
        <td data-label="יעד" title={r.due_date ?? undefined}>
          {r.due_date ? shortDate(r.due_date) : '—'}
          {overdue && <span className="finance-badge finance-badge-warn">באיחור</span>}
        </td>
        <td data-label="כיוון" className={r.direction === 'in' ? 'finance-income' : 'finance-expense'}>
          {r.direction === 'in' ? 'צפי הכנסה' : 'צפי הוצאה'}
        </td>
        <td data-label="עבור">
          {expectedTitle(r)}
          <SourceBadge module={r.source_module} sourceRef={r.source_ref} />
        </td>
        <td
          data-label="סכום"
          className={`finance-amount ${r.direction === 'in' ? 'finance-income' : 'finance-expense'}`}
        >
          <span dir="ltr">{Number(r.amount).toLocaleString('he-IL')} ₪</span>
        </td>
        <td data-label="מצב">{STATUS_LABELS[r.status]}</td>
        <td data-label="הערה" className="muted">
          {r.note}
        </td>
        {canManage && (
          <td className="finance-row-actions">
            {r.status === 'open' && (
              <>
                <button
                  className="btn-ghost btn-sm btn-icon-label"
                  disabled={busy}
                  onClick={() => setFulfillId((id) => (id === r.id ? null : r.id))}
                >
                  <span aria-hidden="true">₪</span>
                  <span className="btn-label">נרשם תשלום</span>
                </button>
                <button className="btn-ghost btn-sm" disabled={busy} onClick={() => cancel(r)} aria-label="בטל צפי">
                  ✕
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
          <span className="muted">צפי הכנסות פתוח</span>
          <strong className="finance-income">{openIn.toLocaleString('he-IL')} ₪</strong>
        </div>
        <div className="card finance-stat stat-expense">
          <span className="muted">צפי הוצאות פתוח</span>
          <strong className="finance-expense">{openOut.toLocaleString('he-IL')} ₪</strong>
        </div>
      </div>

      {error && <div className="error">שגיאה: {error}</div>}

      {loading ? (
        <div className="muted">טוען צפי…</div>
      ) : (
        <div className="card finance-list finance-entries">
          <table className="grid">
            <thead>
              <tr>
                <th>יעד</th>
                <th>כיוון</th>
                <th>עבור</th>
                <th>סכום</th>
                <th>מצב</th>
                <th>הערה</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {open.map(renderRow)}
              {open.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="muted">
                    אין צפי פתוח — חתימת חוזה יוצרת כאן מקדמה ויתרה אוטומטית.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {fulfillRow && canManage && (
            <FulfillForm
              key={fulfillRow.id}
              row={fulfillRow}
              busy={busy}
              onSubmit={(v) => submitFulfill(fulfillRow, v)}
              onCancel={() => setFulfillId(null)}
            />
          )}

          {closed.length > 0 && (
            <div className="finance-load-more">
              <button className="btn-ghost" onClick={() => setShowClosed((v) => !v)}>
                {showClosed ? 'הסתר היסטוריה' : `היסטוריה (${closed.length})`}
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
      !window.confirm(
        `הסכום שונה מהצפי (${Number(row.amount).toLocaleString('he-IL')} ₪). הצפי ייסגר במלואו — להמשיך?`,
      )
    )
      return
    setInvalid(false)
    onSubmit({ amount: n, payment_method: method, date, note })
  }

  return (
    <div className="finance-form finance-fulfill">
      <div className="muted">
        רישום תשלום — {expectedTitle(row)} (
        <span dir="ltr">{Number(row.amount).toLocaleString('he-IL')} ₪</span> צפוי)
      </div>
      {invalid && <div className="error">נא להזין סכום תקין (גדול מ-0).</div>}
      <div className="field-row">
        <label className="field">
          <span className="field-label">סכום (₪)</span>
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
          <span className="field-label">תאריך</span>
          <DateField value={date} onChange={setDate} />
        </label>
      </div>
      <div className="field">
        <span className="field-label">אמצעי תשלום</span>
        <div className="chips chips-grid">
          {PAYMENT_METHODS.map((p) => (
            <button
              key={p}
              type="button"
              className={method === p ? 'chip on' : 'chip'}
              onClick={() => setMethod(p)}
            >
              {PAYMENT_LABELS[p]}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span className="field-label">הערה (לא חובה)</span>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="field-actions">
        <button className="btn-primary btn-block" disabled={busy} onClick={submit}>
          רשום תשלום
        </button>
        <button className="btn-ghost" disabled={busy} onClick={onCancel}>
          בטל
        </button>
      </div>
    </div>
  )
}
