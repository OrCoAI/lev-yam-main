import { useEffect, useState } from 'react'
import { finance } from '../../lib/supabase'
import type { FinanceReport } from '../../types'
import { CATEGORY_LABELS, PAYMENT_LABELS } from './categories'
import DateField from './DateField'
import { toDateStr } from './format'

function monthRange(offset: number) {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  return { from: toDateStr(first), to: toDateStr(last) }
}

const thisMonth = monthRange(0)

export default function ReportTab() {
  const [from, setFrom] = useState(thisMonth.from)
  const [to, setTo] = useState(thisMonth.to)
  const [rep, setRep] = useState<FinanceReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    finance()
      .rpc('report', { p_from: from, p_to: to })
      .then(({ data, error }) => {
        if (!alive) return
        if (error) setError(error.message)
        else {
          setRep(data as FinanceReport)
          setError(null)
        }
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [from, to])

  function applyMonth(offset: number) {
    const r = monthRange(offset)
    setFrom(r.from)
    setTo(r.to)
  }

  const income = rep ? Number(rep.income_total) || 0 : 0
  const expense = rep ? Number(rep.expense_total) || 0 : 0
  const net = rep ? Number(rep.net) || 0 : 0
  const byCategory = rep?.by_category ?? []
  const byPayment = rep?.by_payment ?? []

  return (
    <div>
      <div className="card finance-form">
        <div className="chips">
          <button className="chip" onClick={() => applyMonth(0)}>
            החודש
          </button>
          <button className="chip" onClick={() => applyMonth(-1)}>
            החודש הקודם
          </button>
        </div>
        <div className="field-row">
          <label className="field">
            <span className="field-label">מתאריך</span>
            <DateField value={from} onChange={setFrom} />
          </label>
          <label className="field">
            <span className="field-label">עד תאריך</span>
            <DateField value={to} onChange={setTo} />
          </label>
        </div>
      </div>

      {error && <div className="error">שגיאה: {error}</div>}

      {loading ? (
        <div className="muted">טוען דוח…</div>
      ) : (
        <>
          <div className="finance-summary">
            <div className="card finance-stat stat-income">
              <span className="muted">הכנסות</span>
              <strong className="finance-income">{income.toLocaleString('he-IL')} ₪</strong>
            </div>
            <div className="card finance-stat stat-expense">
              <span className="muted">הוצאות</span>
              <strong className="finance-expense">{expense.toLocaleString('he-IL')} ₪</strong>
            </div>
            <div className="card finance-stat stat-net">
              <span className="muted">נטו</span>
              <strong className={net >= 0 ? 'finance-income' : 'finance-expense'}>
                {net.toLocaleString('he-IL')} ₪
              </strong>
            </div>
          </div>

          <h2 className="section-title">לפי קטגוריה</h2>
          <div className="card finance-list finance-breakdown">
            <table className="grid">
              <thead>
                <tr>
                  <th>סוג</th>
                  <th>קטגוריה</th>
                  <th>סכום</th>
                  <th>תנועות</th>
                </tr>
              </thead>
              <tbody>
                {byCategory.map((b) => {
                  const net = b.kind === 'income' ? Number(b.total) : -Number(b.total)
                  return (
                    <tr key={`${b.kind}:${b.category}`}>
                      <td data-label="סוג" className={b.kind === 'income' ? 'finance-income' : 'finance-expense'}>
                        {b.kind === 'income' ? 'הכנסה' : 'הוצאה'}
                      </td>
                      <td data-label="קטגוריה">{CATEGORY_LABELS[b.category] ?? b.category}</td>
                      <td
                        data-label="סכום"
                        className={`finance-amount ${b.kind === 'income' ? 'finance-income' : 'finance-expense'}`}
                      >
                        {/* reversal rows can turn a range's total negative — sign follows the net */}
                        <span dir="ltr">
                          {net >= 0 ? '+' : '−'}
                          {Math.abs(net).toLocaleString('he-IL')} ₪
                        </span>
                      </td>
                      <td data-label="תנועות">{b.entry_count}</td>
                    </tr>
                  )
                })}
                {byCategory.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      אין תנועות בטווח שנבחר.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h2 className="section-title">לפי אמצעי תשלום</h2>
          <div className="card finance-list finance-breakdown">
            <table className="grid">
              <thead>
                <tr>
                  <th>סוג</th>
                  <th>אמצעי</th>
                  <th>סכום</th>
                  <th>תנועות</th>
                </tr>
              </thead>
              <tbody>
                {byPayment.map((b) => {
                  const net = b.kind === 'income' ? Number(b.total) : -Number(b.total)
                  return (
                    <tr key={`${b.kind}:${b.payment_method}`}>
                      <td data-label="סוג" className={b.kind === 'income' ? 'finance-income' : 'finance-expense'}>
                        {b.kind === 'income' ? 'הכנסה' : 'הוצאה'}
                      </td>
                      <td data-label="אמצעי">{PAYMENT_LABELS[b.payment_method]}</td>
                      <td
                        data-label="סכום"
                        className={`finance-amount ${b.kind === 'income' ? 'finance-income' : 'finance-expense'}`}
                      >
                        <span dir="ltr">
                          {net >= 0 ? '+' : '−'}
                          {Math.abs(net).toLocaleString('he-IL')} ₪
                        </span>
                      </td>
                      <td data-label="תנועות">{b.entry_count}</td>
                    </tr>
                  )
                })}
                {byPayment.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      אין תנועות בטווח שנבחר.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
