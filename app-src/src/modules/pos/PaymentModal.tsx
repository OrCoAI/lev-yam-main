// Collect payment against a bill. Supports partial payments (deposit now, rest
// later): the table stays open until the balance is covered. Overpayment is a
// tip; closing for less than the balance is a discount that MUST be attributed
// (family & friends / staff / service / other) — nothing leaves off-system.
import { useState } from 'react'
import { usePosTr } from './i18n'
import S, { CLAY, SEA } from './styles'
import type { DiscountKind, Payment } from './types'

const CATS: [DiscountKind, string, string][] = [
  ['family_friends', 'משפחה וחברים', 'العائلة والأصدقاء'],
  ['staff', 'צוות', 'الطاقم'],
  ['service', 'פיצוי', 'تعويض'],
  ['other', 'אחר', 'أخرى'],
]

export default function PaymentModal({ total, alreadyPaid, tableLabel, onCancel, onRecord, onPaid }: {
  total: number
  alreadyPaid: number
  tableLabel: string
  onCancel: () => void
  onRecord: (payments: { method: 'cash' | 'card'; amount: number }[]) => void
  onPaid: (payment: Payment) => void
}) {
  const { tr } = usePosTr()
  const [cash, setCash] = useState('')
  const [card, setCard] = useState('')
  const [tipPct, setTipPct] = useState(0)
  const [showDisc, setShowDisc] = useState(false)
  const [discKind, setDiscKind] = useState<DiscountKind | null>(null)
  const [discNote, setDiscNote] = useState('')

  const cashN = parseInt(cash, 10) || 0
  const cardN = parseInt(card, 10) || 0
  const thisPaid = cashN + cardN
  const remaining = Math.max(0, total - alreadyPaid)     // left before this payment
  const newPaid = alreadyPaid + thisPaid
  const tip = Math.max(0, newPaid - total)               // overpayment → tip
  const shortfall = Math.max(0, total - newPaid)         // underpayment → discount (on close)
  const covered = total > 0 && newPaid >= total
  const sugg = Math.round((total * tipPct) / 100)
  const collect = remaining + sugg                        // quick-fill target

  const closingArr = () => ([
    ...(cashN > 0 ? [{ method: 'cash' as const, amount: cashN }] : []),
    ...(cardN > 0 ? [{ method: 'card' as const, amount: cardN }] : []),
  ])

  const msg = total === 0 ? tr('אין פריטים בחשבון', 'لا أصناف في الحساب')
    : covered ? (tip > 0 ? tr('טיפ', 'بقشيش') + ': ' + tip + ' ₪ ✓' : tr('שולם במלואו', 'مدفوع بالكامل') + ' ✓')
    : thisPaid > 0 ? tr('נותר', 'المتبقي') + ' ' + shortfall + ' ₪'
    : tr('נותר לתשלום', 'المتبقي للدفع') + ' ' + remaining + ' ₪'

  // a discount close needs a category, and 'other' needs a written reason
  const discValid = !!discKind && (discKind !== 'other' || !!discNote.trim())
  const recordPartial = () => { if (thisPaid > 0) onRecord(closingArr()) }
  const closeCovered = () =>
    onPaid({ cash: cashN, card: cardN, discount: 0, tip, total, payments: closingArr(), discountKind: null, discountReason: null })
  const closeDiscount = () => {
    if (!discValid) return
    onPaid({ cash: cashN, card: cardN, discount: shortfall, tip: 0, total: newPaid,
      payments: closingArr(), discountKind: discKind, discountReason: discNote.trim() || null })
  }

  // ── discount attribution sub-panel ──
  if (showDisc) {
    const needNote = discKind === 'other'
    return (
      <div style={S.overlay} onClick={onCancel}>
        <div style={S.receipt} onClick={(e) => e.stopPropagation()}>
          <div style={S.payHead}>
            <div style={S.payTotalLbl}>{tr('הנחה', 'خصم') + ' · ' + tableLabel}</div>
            <div style={S.payTotalBig}>{shortfall} ₪</div>
            <div style={S.payHeadNote}>{tr('למי ההנחה?', 'لمن الخصم؟')}</div>
          </div>
          <div style={S.payBody}>
            <div style={S.discGrid}>
              {CATS.map(([k, he, ar]) => (
                <button key={k} className="pos-tap"
                  style={{ ...S.discChip, ...(discKind === k ? S.discChipOn : {}) }}
                  onClick={() => setDiscKind(k)}>{tr(he, ar)}</button>
              ))}
            </div>
            <input style={S.discNoteInput}
              placeholder={needNote ? tr('פירוט חובה', 'التفصيل إلزامي') : tr('הערה (אופציונלי)', 'ملاحظة (اختياري)')}
              value={discNote} onChange={(e) => setDiscNote(e.target.value)} />
            <div style={{ ...S.payRemain, ...S.payRemainBad }}>
              {tr('החשבון ייסגר עם הנחה של', 'سيُغلق الحساب بخصم') + ' ' + shortfall + ' ₪'}
            </div>
          </div>
          <div style={S.payBtns}>
            <button className="pos-tap" style={S.receiptClose} onClick={() => setShowDisc(false)}>{tr('חזרה', 'رجوع')}</button>
            <button className="pos-tap"
              style={{ ...S.payConfirm, background: discValid ? CLAY : '#cfc6b6', color: '#fff', cursor: discValid ? 'pointer' : 'not-allowed' }}
              disabled={!discValid} onClick={closeDiscount}>{tr('אישור הנחה וסגירה', 'تأكيد الخصم والإغلاق')}</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={S.overlay} onClick={onCancel}>
      <div style={S.receipt} onClick={(e) => e.stopPropagation()}>
        <div style={S.payHead}>
          <div style={S.payTotalLbl}>{tr('תשלום', 'الدفع') + ' · ' + tableLabel}</div>
          <div style={S.payTotalBig}>{total} ₪</div>
          {alreadyPaid > 0 && (
            <div style={S.payHeadNote}>{tr('שולם', 'مدفوع') + ' ' + alreadyPaid + ' ₪ · ' + tr('נותר', 'المتبقي') + ' ' + remaining + ' ₪'}</div>
          )}
          {sugg > 0 && (
            <div style={S.payHeadNote}>{'+ ' + tr('טיפ', 'بقشيش') + ' ' + sugg + ' ₪'}</div>
          )}
        </div>

        <div style={S.payBody}>
          <div style={S.tipCalcHead}>{tr('מחשבון טיפ', 'حاسبة البقشيش')}</div>
          <div style={S.payQuick}>
            {[0, 10, 12, 15].map((p) => (
              <button key={p} className="pos-tap" style={{ ...S.payChip, ...(tipPct === p ? S.payChipOn : {}) }} onClick={() => setTipPct(p)}>
                {p === 0 ? tr('ללא', 'بدون') : p + '%'}
              </button>
            ))}
          </div>
          <div style={S.payQuick}>
            <button className="pos-tap" style={S.payChip} onClick={() => { setCash(String(collect)); setCard('') }}>{tr('הכל מזומן', 'الكل نقداً')}</button>
            <button className="pos-tap" style={S.payChip} onClick={() => { setCard(String(collect)); setCash('') }}>{tr('הכל אשראי', 'الكل بطاقة')}</button>
            <button className="pos-tap" style={S.payChip} onClick={() => { setCash(''); setCard('') }}>{tr('נקה', 'مسح')}</button>
          </div>
          <div style={S.payField}>
            <span style={S.payFieldLbl}>{tr('מזומן', 'نقداً')}</span>
            <input style={S.payInput} type="number" inputMode="numeric" placeholder="0" value={cash} onChange={(e) => setCash(e.target.value)} />
            <span style={S.payCur}>₪</span>
          </div>
          <div style={S.payField}>
            <span style={S.payFieldLbl}>{tr('אשראי', 'بطاقة')}</span>
            <input style={S.payInput} type="number" inputMode="numeric" placeholder="0" value={card} onChange={(e) => setCard(e.target.value)} />
            <span style={S.payCur}>₪</span>
          </div>
          <div style={{ ...S.payRemain, ...(covered ? S.payRemainOk : S.payRemainBad) }}>{msg}</div>
        </div>

        <div style={S.payBtns}>
          <button className="pos-tap" style={S.receiptClose} onClick={onCancel}>{tr('ביטול', 'إلغاء')}</button>
          {total === 0 ? null : covered ? (
            <button className="pos-tap" style={{ ...S.payConfirm, background: '#3a9e6e', color: '#fff' }} onClick={closeCovered}>
              {tr('סגירת שולחן', 'إغلاق الطاولة')}
            </button>
          ) : (
            <>
              <button className="pos-tap"
                style={{ ...S.payConfirm, background: thisPaid > 0 ? SEA : '#cfc6b6', color: '#fff', cursor: thisPaid > 0 ? 'pointer' : 'not-allowed', flex: 1 }}
                disabled={thisPaid <= 0} onClick={recordPartial}>{tr('רישום תשלום', 'تسجيل دفعة')}</button>
              <button className="pos-tap" style={{ ...S.payConfirm, background: CLAY, color: '#fff', flex: 1 }} onClick={() => setShowDisc(true)}>
                {tr('סגירה בהנחה', 'إغلاق بخصم')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
