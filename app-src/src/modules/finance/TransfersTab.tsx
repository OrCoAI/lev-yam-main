// Cash↔bank movement — money changing pocket, not money earned or spent.
//
// Its own tab rather than a row type inside the entries list, for the same
// reason it is its own table (57_finance_transfers.sql): the entries list, its
// kind filter, its pagination and its edit/delete paths all assume every row is
// an income or an expense. Threading a third kind through them would put a
// non-P&L row inside code whose whole job is P&L — the coupling the separate
// table exists to avoid, reintroduced one layer up.
import { useCallback, useEffect, useState } from 'react'
import { finance } from '../../lib/supabase'
import { useRowDisclosure } from '../../lib/useRowDisclosure'
import type { FinancePaymentMethod, FinanceTransfer } from '../../types'
import { PAYMENT_METHODS } from './categories'
import DateField from './DateField'
import ErrorNotice from './ErrorNotice'
import { amount as fmtAmount, shortDate, todayStr } from './format'
import { useFT } from './i18n'

interface TransferPayload {
  amount: number
  from_method: FinancePaymentMethod
  to_method: FinancePaymentMethod
  transfer_date: string
  note: string | null
}

export default function TransfersTab({ canManage }: { canManage: boolean }) {
  const ft = useFT()
  const { isPhone, rowProps } = useRowDisclosure()
  const [rows, setRows] = useState<FinanceTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<FinanceTransfer | null>(null)
  const [formEpoch, setFormEpoch] = useState(0)
  const [formOpen, setFormOpen] = useState(!isPhone)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await finance()
      .from('transfers')
      .select('*')
      .order('transfer_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    else {
      setRows((data as FinanceTransfer[] | null) ?? [])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save(payload: TransferPayload) {
    setBusy(true)
    const res = editing
      ? await finance().from('transfers').update(payload).eq('id', editing.id)
      : await finance().from('transfers').insert(payload)
    setBusy(false)
    if (res.error) {
      setError(res.error.message)
      return
    }
    setEditing(null)
    setError(null)
    setFormEpoch((n) => n + 1)
    if (isPhone) setFormOpen(false)
    await load()
  }

  async function remove(id: string) {
    if (!window.confirm(ft.confirmDelete)) return
    setBusy(true)
    const { error: err } = await finance().from('transfers').delete().eq('id', id)
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    if (editing?.id === id) setEditing(null)
    await load()
  }

  return (
    <div>
      <p className="notice">{ft.transferIntro}</p>

      {canManage && !formOpen && (
        <button className="btn-primary form-open-btn" onClick={() => setFormOpen(true)}>
          + {ft.transferAdd}
        </button>
      )}
      {canManage && formOpen && (
        <TransferForm
          key={editing?.id ?? `new-${formEpoch}`}
          initial={editing}
          busy={busy}
          onSubmit={save}
          onCancelEdit={() => setEditing(null)}
          onClose={!editing && isPhone ? () => setFormOpen(false) : undefined}
        />
      )}

      {error && <ErrorNotice error={error} />}

      {loading ? (
        <div className="muted">{ft.loading}</div>
      ) : (
        <div className="card rowline">
          <table className="grid">
            <thead>
              <tr>
                <th>{ft.colDate}</th>
                <th>{ft.transferColRoute}</th>
                <th>{ft.colAmount}</th>
                <th>{ft.colNote}</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} {...rowProps(r.id)}>
                  <td className="rl-lead" title={r.transfer_date}>
                    {shortDate(r.transfer_date)}
                  </td>
                  <td className="rl-main">
                    {ft.paymentLabels[r.from_method]}
                    <span aria-hidden="true"> ← </span>
                    {ft.paymentLabels[r.to_method]}
                  </td>
                  <td className="rl-amt finance-amount">
                    <span dir="ltr">{fmtAmount(r.amount)}</span>
                  </td>
                  <td className="rl-more muted" data-label={ft.colNote}>
                    {r.note ?? ''}
                  </td>
                  {canManage && (
                    <td className="rl-actions">
                      <button
                        className="btn-ghost btn-sm btn-icon-label"
                        disabled={busy}
                        onClick={() => {
                          setEditing(r)
                          setFormOpen(true)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        aria-label={ft.edit}
                      >
                        <span aria-hidden="true">✎</span>
                        <span className="btn-label">{ft.edit}</span>
                      </button>
                      <button
                        className="btn-ghost btn-sm btn-icon-label"
                        disabled={busy}
                        onClick={() => remove(r.id)}
                        aria-label={ft.delete}
                      >
                        <span aria-hidden="true">✕</span>
                        <span className="btn-label">{ft.delete}</span>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 5 : 4} className="muted">
                    {ft.transferNone}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Owns its field state so keystrokes don't re-render the list (the pattern
// EntriesTab and ExpectedTab both use). Remounted via key on edit.
function TransferForm({
  initial,
  busy,
  onSubmit,
  onCancelEdit,
  onClose,
}: {
  initial: FinanceTransfer | null
  busy: boolean
  onSubmit: (payload: TransferPayload) => void
  onCancelEdit: () => void
  onClose?: () => void
}) {
  const ft = useFT()
  const [from, setFrom] = useState<FinancePaymentMethod>(initial?.from_method ?? 'cash')
  const [to, setTo] = useState<FinancePaymentMethod>(initial?.to_method ?? 'bank')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [date, setDate] = useState(initial?.transfer_date ?? todayStr())
  const [note, setNote] = useState(initial?.note ?? '')
  const [invalid, setInvalid] = useState<string | null>(null)

  // Picking the same pocket on both sides is rejected by the DB
  // (finance_transfers_distinct_check); say so before the round trip rather
  // than surfacing a constraint name.
  const same = from === to

  function submit() {
    const n = Number(amount)
    if (!n || n <= 0) {
      setInvalid(ft.invalidAmount)
      return
    }
    if (same) {
      setInvalid(ft.transferSameMethod)
      return
    }
    setInvalid(null)
    onSubmit({
      amount: n,
      from_method: from,
      to_method: to,
      transfer_date: date,
      note: note.trim() || null,
    })
  }

  return (
    <div className="card finance-form">
      <div className="field-row">
        <label className="field">
          <span className="field-label">{ft.transferFrom}</span>
          <select value={from} onChange={(e) => setFrom(e.target.value as FinancePaymentMethod)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {ft.paymentLabels[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">{ft.transferTo}</span>
          <select value={to} onChange={(e) => setTo(e.target.value as FinancePaymentMethod)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {ft.paymentLabels[m]}
              </option>
            ))}
          </select>
        </label>
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
          <DateField value={date} onChange={setDate} />
        </label>
      </div>

      <label className="field">
        <span className="field-label">{ft.noteOptional}</span>
        <input
          type="text"
          placeholder={ft.transferNotePlaceholder}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      {same && <div className="field-hint muted">{ft.transferSameMethod}</div>}
      {invalid && <div className="error">{invalid}</div>}

      <div className="field-actions">
        <button className="btn-primary btn-block" disabled={busy || same} onClick={submit}>
          {initial ? ft.transferUpdate : ft.transferSubmit}
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
