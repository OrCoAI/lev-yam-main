// Reason picker for removing an item already sent to the kitchen — a written-off
// cost, so the reason is a structured choice (mistake / customer / other), not
// free text. "Other" requires a note so nothing is written off unexplained.
import { useState } from 'react'
import { usePosTr } from './i18n'
import S, { CLAY } from './styles'

const REASONS: [string, string, string][] = [
  ['mistake', 'טעות', 'خطأ'],
  ['customer', 'לקוח', 'زبون'],
  ['other', 'אחר', 'أخرى'],
]

export default function VoidReasonModal({ label, onCancel, onConfirm }: {
  label: string
  onCancel: () => void
  onConfirm: (reason: string) => void
}) {
  const { tr } = usePosTr()
  const [kind, setKind] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const needNote = kind === 'other'
  const valid = !!kind && (!needNote || !!note.trim())
  const confirm = () => { if (valid) onConfirm(needNote ? note.trim() : kind as string) }

  return (
    <div style={S.overlay} onClick={onCancel}>
      <div style={S.receipt} onClick={(e) => e.stopPropagation()}>
        <div style={{ ...S.payHead, background: CLAY }}>
          <div style={S.payTotalLbl}>{tr('הסרת פריט מהמטבח', 'حذف صنف من المطبخ')}</div>
          <div style={{ ...S.payTotalBig, fontSize: 22 }}>{label}</div>
          <div style={S.payHeadNote}>{tr('סיבת ההסרה', 'سبب الحذف')}</div>
        </div>
        <div style={S.payBody}>
          <div style={S.payQuick}>
            {REASONS.map(([k, he, ar]) => (
              <button key={k} className="pos-tap" style={{ ...S.discChip, flex: 1, ...(kind === k ? S.discChipOn : {}) }} onClick={() => setKind(k)}>
                {tr(he, ar)}
              </button>
            ))}
          </div>
          {needNote && (
            <input style={S.discNoteInput} placeholder={tr('פירוט חובה', 'التفصيل إلزامي')} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
          )}
        </div>
        <div style={S.payBtns}>
          <button className="pos-tap" style={S.receiptClose} onClick={onCancel}>{tr('ביטול', 'إلغاء')}</button>
          <button className="pos-tap"
            style={{ ...S.payConfirm, background: valid ? CLAY : '#cfc6b6', color: '#fff', cursor: valid ? 'pointer' : 'not-allowed' }}
            disabled={!valid} onClick={confirm}>{tr('אישור הסרה', 'تأكيد الحذف')}</button>
        </div>
      </div>
    </div>
  )
}
