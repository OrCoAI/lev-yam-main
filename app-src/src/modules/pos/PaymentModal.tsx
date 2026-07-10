// Cash/card split with tip calculator. Overpayment becomes the tip;
// underpayment is a (customer-invisible) discount, confirmed before closing.
import { useState } from 'react'
import { usePosTr } from './i18n'
import S from './styles'
import type { Payment } from './types'

export default function PaymentModal({ total, tableLabel, onCancel, onConfirm }: {
  total: number
  tableLabel: string
  onCancel: () => void
  onConfirm: (payment: Payment) => void
}) {
  const { tr } = usePosTr()
  const [cash, setCash] = useState('')
  const [card, setCard] = useState('')
  const [tipPct, setTipPct] = useState(0) // tip-calculator selection
  const cashN = parseInt(cash, 10) || 0
  const cardN = parseInt(card, 10) || 0
  const paid = cashN + cardN
  const sugg = Math.round((total * tipPct) / 100) // suggested tip from the calculator
  const collect = total + sugg // bill + suggested tip (quick-fill target)
  const tipN = Math.max(0, paid - total) // overpayment becomes the tip
  const shortfall = Math.max(0, total - paid) // underpayment → hidden discount (asked on close)
  const fullyPaid = total > 0 && paid >= total
  const ok = total > 0 && paid > 0

  const msg = total === 0 ? tr('אין פריטים בחשבון', 'لا أصناف في الحساب')
    : paid === 0 ? tr('הזינו סכום שהתקבל', 'أدخل المبلغ المستلم')
    : shortfall > 0 ? tr('חסר', 'ناقص') + ' ' + shortfall + ' ₪ · ' + tr('הנחה?', 'خصم؟')
    : tipN > 0 ? tr('טיפ', 'بقشيش') + ': ' + tipN + ' ₪ ✓'
    : tr('מאוזן', 'متوازن') + ' ✓'

  const confirm = () => {
    if (!ok) return
    if (shortfall > 0) {
      const q = tr(
        'התקבל ' + paid + ' ₪ מתוך ' + total + ' ₪.\nלהחיל הנחה של ' + shortfall + ' ₪ ולסגור את השולחן?',
        'تم استلام ' + paid + ' ₪ من أصل ' + total + ' ₪.\nتطبيق خصم بقيمة ' + shortfall + ' ₪ وإغلاق الطاولة؟',
      )
      if (!window.confirm(q)) return
      onConfirm({ cash: cashN, card: cardN, discount: shortfall, tip: 0, total: paid })
    } else {
      onConfirm({ cash: cashN, card: cardN, discount: 0, tip: tipN, total })
    }
  }

  return (
    <div style={S.overlay} onClick={onCancel}>
      <div style={S.receipt} onClick={(e) => e.stopPropagation()}>
        <div style={S.payHead}>
          <div style={S.payTotalLbl}>{tr('תשלום', 'الدفع') + ' · ' + tableLabel}</div>
          <div style={S.payTotalBig}>{total} ₪</div>
          {sugg > 0 && (
            <div style={S.payHeadNote}>{'+ ' + tr('טיפ', 'بقشيش') + ' ' + sugg + ' ₪ = ' + collect + ' ₪'}</div>
          )}
        </div>

        <div style={S.payBody}>
          <div style={S.tipCalcHead}>{tr('מחשבון טיפ', 'حاسبة البقشيش')}</div>
          <div style={S.payQuick}>
            {[0, 10, 12, 15].map((p) => (
              <button
                key={p}
                className="pos-tap"
                style={{ ...S.payChip, ...(tipPct === p ? S.payChipOn : {}) }}
                onClick={() => setTipPct(p)}
              >
                {p === 0 ? tr('ללא', 'بدون') : p + '%'}
              </button>
            ))}
          </div>

          <div style={S.payQuick}>
            <button className="pos-tap" style={S.payChip} onClick={() => { setCash(String(collect)); setCard('') }}>
              {tr('הכל מזומן', 'الكل نقداً')}
            </button>
            <button className="pos-tap" style={S.payChip} onClick={() => { setCard(String(collect)); setCash('') }}>
              {tr('הכל אשראי', 'الكل بطاقة')}
            </button>
            <button className="pos-tap" style={S.payChip} onClick={() => { setCash(''); setCard('') }}>
              {tr('נקה', 'مسح')}
            </button>
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
          <div style={{ ...S.payRemain, ...(fullyPaid ? S.payRemainOk : S.payRemainBad) }}>{msg}</div>
        </div>

        <div style={S.payBtns}>
          <button className="pos-tap" style={S.receiptClose} onClick={onCancel}>{tr('ביטול', 'إلغاء')}</button>
          <button
            className="pos-tap"
            style={{ ...S.payConfirm, background: ok ? '#3a9e6e' : '#cfc6b6', color: '#fff', cursor: ok ? 'pointer' : 'not-allowed' }}
            disabled={!ok}
            onClick={confirm}
          >
            {tr('אישור וסגירה', 'تأكيد وإغلاق')}
          </button>
        </div>
      </div>
    </div>
  )
}
