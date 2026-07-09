import { useEffect, useState } from 'react'
import { getSettings, setChecklist } from './api'
import { formatDate } from './format'
import { useQT } from './i18n'
import type { ChecklistItem, QuoteRow } from './types'

/** Per-event prep checklist. A confirmed quote without a checklist (legacy /
 *  imported rows) gets seeded from the settings template on first open.
 *  readOnly (no quotes.manage): items display but nothing writes — the DB
 *  would reject the write anyway (RLS), so don't offer the controls. */
export default function ChecklistModal({
  quote,
  readOnly,
  onClose,
  onChanged,
}: {
  quote: QuoteRow
  readOnly: boolean
  onClose: () => void
  onChanged: (items: ChecklistItem[]) => void
}) {
  const qt = useQT()
  const [items, setItems] = useState<ChecklistItem[] | null>(
    quote.prep_checklist.length > 0 ? quote.prep_checklist : null,
  )
  const [newText, setNewText] = useState('')

  useEffect(() => {
    if (items) return
    if (readOnly) {
      // seeding writes the template to the row — viewers can't, show as-is
      setItems([])
      return
    }
    getSettings()
      .then((s) => {
        const seeded = s.default_prep_checklist.map((text) => ({ text, done: false }))
        setItems(seeded)
        // separate catch: a failed persist must not wipe the seeded list
        setChecklist(quote.id, seeded)
          .then(() => onChanged(seeded))
          .catch((e: Error) => alert(e.message))
      })
      .catch(() => setItems([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = (next: ChecklistItem[]) => {
    if (readOnly) return
    setItems(next)
    setChecklist(quote.id, next)
      .then(() => onChanged(next))
      .catch((e: Error) => alert(e.message))
  }

  const toggle = (i: number) => save(items!.map((it, j) => (j === i ? { ...it, done: !it.done } : it)))
  const remove = (i: number) => save(items!.filter((_, j) => j !== i))
  const add = () => {
    const t = newText.trim()
    if (!t) return
    save([...items!, { text: t, done: false }])
    setNewText('')
  }

  const total = items?.length ?? 0
  const done = items?.filter((i) => i.done).length ?? 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">
          {qt.checklistTitle} {quote.customer_name}
        </div>
        <div className="chk-meta">
          {[quote.event_type, formatDate(quote.event_date), quote.hours].filter(Boolean).join(' · ')}
        </div>
        {items === null ? (
          <div className="chk-meta">{qt.loading}</div>
        ) : (
          <>
            <div className="chk-meta">
              {done}/{total} {qt.checklistDone} {done === total && total > 0 ? '🎉' : ''}
            </div>
            <div className="chk-bar">
              <div className="chk-bar-fill" style={{ width: (total ? (done / total) * 100 : 0) + '%' }} />
            </div>
            <div className="chk-list">
              {items.map((it, i) => (
                <div key={i} className={'chk-item' + (it.done ? ' done' : '')}>
                  <input type="checkbox" checked={it.done} disabled={readOnly} onChange={() => toggle(i)} />
                  <span className="chk-text" onClick={() => !readOnly && toggle(i)}>
                    {it.text}
                  </span>
                  {!readOnly && (
                    <button className="chk-del" title={qt.remove} onClick={() => remove(i)}>
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            {!readOnly && (
              <div className="chk-add">
                <input
                  value={newText}
                  placeholder={qt.checklistAddPlaceholder}
                  onChange={(e) => setNewText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') add()
                  }}
                />
                <button disabled={!newText.trim()} onClick={add}>
                  {qt.add}
                </button>
              </div>
            )}
          </>
        )}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>
            {qt.close}
          </button>
        </div>
      </div>
    </div>
  )
}
