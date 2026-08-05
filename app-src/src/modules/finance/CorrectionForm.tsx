// The owner's correction — "this number is wrong, the real one is X".
//
// Deliberately NOT an edit. The original posting stays exactly as its module
// wrote it and a second, additive row moves the total (56_finance_override.sql);
// both stay visible in the ledger, so the books explain themselves. That is what
// keeps ARCHITECTURE §7.4 (derived rows are immutable) intact while still giving
// the owner the last word.
//
// The current total comes from the server, never from the row the owner clicked:
// a POS leg's total is spread across its original posting plus every re-post
// correction since, which this page has not necessarily loaded.
import { useEffect, useState } from 'react'
import { finance } from '../../lib/supabase'
import ErrorNotice from './ErrorNotice'
import { amount as fmtAmount } from './format'
import { useFT } from './i18n'

interface Preview {
  target: string
  kind: string
  category: string
  entry_date: string
  current_total: number
}

export default function CorrectionForm({
  entryId,
  onDone,
  onCancel,
}: {
  entryId: string
  onDone: () => void
  onCancel: () => void
}) {
  const ft = useFT()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [correct, setCorrect] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    finance()
      .rpc('correction_preview', { p_entry: entryId })
      .then(({ data, error: err }) => {
        if (!alive) return
        if (err) setError(err.message)
        else {
          setPreview(data as Preview)
          setCorrect(String((data as Preview).current_total))
        }
      })
    return () => {
      alive = false
    }
  }, [entryId])

  async function submit() {
    const n = Number(correct)
    if (!Number.isFinite(n) || n < 0 || !reason.trim()) {
      setError(ft.correctionInvalid)
      return
    }
    setBusy(true)
    const { error: err } = await finance().rpc('post_correction', {
      p_entry: entryId,
      p_amount: n,
      p_reason: reason.trim(),
    })
    setBusy(false)
    if (err) setError(err.message)
    else onDone()
  }

  if (error && !preview) return <ErrorNotice error={error} />
  if (!preview) return <div className="muted">{ft.loading}</div>

  const target = Number(correct)
  const delta = Number.isFinite(target) ? target - preview.current_total : 0

  // no `card`: .finance-correction is the box (same as .finance-fulfill, its
  // sibling inline form), and `card` only added a background and shadow under it
  // while having three of its own properties overridden
  return (
    <div className="finance-form finance-correction">
      <p className="finance-correction-title">{ft.correctionTitle}</p>
      <p className="muted field-hint">{ft.correctionExplain}</p>

      <div className="finance-correction-now">
        <span>{ft.correctionCurrent}</span>
        <span className="finance-amount" dir="ltr">
          {fmtAmount(preview.current_total)}
        </span>
      </div>

      <label className="field">
        <span className="field-label">{ft.correctionCorrect}</span>
        <input
          type="number"
          dir="ltr"
          inputMode="decimal"
          step="0.01"
          value={correct}
          onChange={(e) => setCorrect(e.target.value)}
        />
      </label>

      {delta !== 0 && (
        <p className="field-hint">
          {ft.correctionDelta}{' '}
          <span className="finance-amount" dir="ltr">
            {delta > 0 ? '+' : ''}
            {fmtAmount(delta)}
          </span>
        </p>
      )}

      <label className="field">
        {/* required by the DB too — an override with no stated reason is an
            unauditable number, and staying explainable is the whole basis for
            allowing it at all */}
        <span className="field-label">{ft.correctionReason}</span>
        <input
          type="text"
          placeholder={ft.correctionReasonPlaceholder}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>

      {error && <ErrorNotice error={error} />}

      <div className="field-actions">
        <button className="btn-primary btn-block" disabled={busy} onClick={submit}>
          {busy ? ft.loading : ft.correctionSubmit}
        </button>
        <button className="btn-ghost" disabled={busy} onClick={onCancel}>
          {ft.cancel}
        </button>
      </div>
    </div>
  )
}
