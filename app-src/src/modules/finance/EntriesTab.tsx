import { useCallback, useEffect, useRef, useState } from 'react'
import { finance } from '../../lib/supabase'
import type { FinanceCategory, FinanceEntry, FinanceKind, FinancePaymentMethod } from '../../types'
import {
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_LABELS,
  PAYMENT_METHODS,
} from './categories'

const PAGE_SIZE = 100

function todayStr() {
  return new Date().toLocaleDateString('en-CA') // 'YYYY-MM-DD' in local time
}

function categoriesFor(kind: FinanceKind) {
  return kind === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
}

const emptyForm = {
  kind: 'expense' as FinanceKind,
  category: EXPENSE_CATEGORIES[0] as FinanceCategory,
  payment_method: 'cash' as FinancePaymentMethod,
  amount: '',
  entry_date: todayStr(),
  note: '',
}

export default function EntriesTab({ canManage }: { canManage: boolean }) {
  const [entries, setEntries] = useState<FinanceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  const loadIdRef = useRef(0)
  const offsetRef = useRef(0)

  const load = useCallback(async (append = false) => {
    const id = ++loadIdRef.current
    if (append) setLoadingMore(true)
    else {
      setLoading(true)
      offsetRef.current = 0
    }
    const offset = append ? offsetRef.current : 0
    const { data, error } = await finance()
      .from('entries')
      .select('*')
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
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function changeKind(kind: FinanceKind) {
    setForm((f) => ({ ...f, kind, category: categoriesFor(kind)[0] }))
  }

  function startEdit(e: FinanceEntry) {
    setEditingId(e.id)
    setForm({
      kind: e.kind,
      category: e.category,
      payment_method: e.payment_method ?? 'cash',
      amount: String(e.amount),
      entry_date: e.entry_date,
      note: e.note ?? '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
  }

  async function submit() {
    const amount = Number(form.amount)
    if (!amount || amount <= 0) {
      setError('נא להזין סכום תקין (גדול מ-0).')
      return
    }
    setBusy(true)
    const payload = {
      kind: form.kind,
      category: form.category,
      payment_method: form.payment_method,
      amount,
      entry_date: form.entry_date,
      note: form.note.trim() || null,
    }
    const res = editingId
      ? await finance().from('entries').update(payload).eq('id', editingId)
      : await finance().from('entries').insert(payload)
    setBusy(false)
    if (res.error) {
      setError(res.error.message)
      return
    }
    cancelEdit()
    await load()
  }

  async function remove(id: string) {
    if (!window.confirm('למחוק את התנועה? לא ניתן לשחזר.')) return
    setBusy(true)
    const { error } = await finance().from('entries').delete().eq('id', id)
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    if (editingId === id) cancelEdit()
    await load()
  }

  return (
    <div>
      {canManage && (
        <div className="card finance-form">
          {/* income / expense */}
          <div className="seg seg-2">
            <button
              type="button"
              className={form.kind === 'expense' ? 'seg-btn on' : 'seg-btn'}
              onClick={() => changeKind('expense')}
            >
              הוצאה
            </button>
            <button
              type="button"
              className={form.kind === 'income' ? 'seg-btn on income' : 'seg-btn'}
              onClick={() => changeKind('income')}
            >
              הכנסה
            </button>
          </div>

          <label className="field">
            <span className="field-label">קטגוריה</span>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as FinanceCategory }))}
            >
              {categoriesFor(form.kind).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>

          <div className="field">
            <span className="field-label">אמצעי תשלום</span>
            <div className="chips chips-grid">
              {PAYMENT_METHODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={form.payment_method === p ? 'chip on' : 'chip'}
                  onClick={() => setForm((f) => ({ ...f, payment_method: p }))}
                >
                  {PAYMENT_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          <div className="field-row">
            <label className="field">
              <span className="field-label">סכום (₪)</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="0"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </label>
            <label className="field">
              <span className="field-label">תאריך</span>
              <input
                type="date"
                value={form.entry_date}
                onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))}
              />
            </label>
          </div>

          <label className="field">
            <span className="field-label">הערה (לא חובה)</span>
            <input
              type="text"
              placeholder="למשל: שכירות יוני"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </label>

          <div className="field-actions">
            <button
              className={`btn-primary btn-block ${form.kind === 'income' ? 'btn-income' : 'btn-expense'}`}
              disabled={busy}
              onClick={submit}
            >
              {editingId ? 'עדכן תנועה' : 'הוסף תנועה'}
            </button>
            {editingId && (
              <button className="btn-ghost" disabled={busy} onClick={cancelEdit}>
                בטל
              </button>
            )}
          </div>
        </div>
      )}

      {error && <div className="error">שגיאה: {error}</div>}

      {loading ? (
        <div className="muted">טוען תנועות…</div>
      ) : (
        <div className="card finance-list finance-entries">
          <table className="grid">
            <thead>
              <tr>
                <th>תאריך</th>
                <th>סוג</th>
                <th>קטגוריה</th>
                <th>תשלום</th>
                <th>סכום</th>
                <th>הערה</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td data-label="תאריך">{e.entry_date}</td>
                  <td data-label="סוג" className={e.kind === 'income' ? 'finance-income' : 'finance-expense'}>
                    {e.kind === 'income' ? 'הכנסה' : 'הוצאה'}
                  </td>
                  <td data-label="קטגוריה">{CATEGORY_LABELS[e.category] ?? e.category}</td>
                  <td data-label="תשלום">{e.payment_method ? PAYMENT_LABELS[e.payment_method] : '—'}</td>
                  <td
                    data-label="סכום"
                    className={`finance-amount ${e.kind === 'income' ? 'finance-income' : 'finance-expense'}`}
                  >
                    {e.kind === 'income' ? '+' : '−'}
                    {e.amount.toLocaleString('he-IL')} ₪
                  </td>
                  <td data-label="הערה" className="muted">
                    {e.note ?? ''}
                  </td>
                  {canManage && (
                    <td className="finance-row-actions">
                      <button
                        className="btn-ghost btn-sm btn-icon-label"
                        disabled={busy}
                        onClick={() => startEdit(e)}
                        aria-label="ערוך"
                      >
                        <span aria-hidden="true">✎</span>
                        <span className="btn-label">ערוך</span>
                      </button>
                      <button
                        className="btn-ghost btn-sm"
                        disabled={busy}
                        onClick={() => remove(e.id)}
                        aria-label="מחק"
                      >
                        ✕
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="muted">
                    אין תנועות עדיין.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {hasMore && (
            <div className="finance-load-more">
              <button className="btn-ghost" disabled={loadingMore} onClick={() => load(true)}>
                {loadingMore ? 'טוען…' : 'טען עוד'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
