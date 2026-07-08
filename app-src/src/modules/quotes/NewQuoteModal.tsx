import { useState } from 'react'
import { createQuote } from './api'
import { useQT } from './i18n'
import type { QuotesStrings } from './i18n'

const EMPTY = {
  customer_name: '',
  contact_person: '',
  phone: '',
  email: '',
  event_type: '',
  event_date: '',
  guests: '',
  hours: '',
}
type FormState = typeof EMPTY

const FIELDS: { key: keyof FormState; label: keyof QuotesStrings; type?: string; required?: boolean }[] = [
  { key: 'customer_name', label: 'fCustomer', required: true },
  { key: 'contact_person', label: 'fContact' },
  { key: 'phone', label: 'fPhone', type: 'tel' },
  { key: 'email', label: 'fEmail', type: 'email' },
  { key: 'event_type', label: 'fEventType' },
  { key: 'event_date', label: 'fEventDate', type: 'date' },
  { key: 'guests', label: 'fGuests', type: 'number' },
  { key: 'hours', label: 'fHours' },
]

export default function NewQuoteModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const qt = useQT()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      await createQuote(form)
      onCreated()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{qt.newQuoteTitle}</div>
        {FIELDS.map((f) => (
          <label key={f.key} className="modal-field">
            {qt[f.label] as string}
            {f.required ? ' *' : ''}
            <input
              type={f.type ?? 'text'}
              value={form[f.key]}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
              autoFocus={f.key === 'customer_name'}
            />
          </label>
        ))}
        <div className="modal-actions">
          <button
            className="btn-primary"
            disabled={!form.customer_name.trim() || saving}
            onClick={submit}
          >
            {saving ? qt.creating : qt.create}
          </button>
          <button className="btn-ghost" onClick={onClose}>
            {qt.cancel}
          </button>
        </div>
      </div>
    </div>
  )
}
