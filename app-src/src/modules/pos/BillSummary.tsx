// Customer-facing bill overlay: the ordered lines and the total, optional
// payment QR. À-la-carte only (open house retired 2026-07-28).
import { useState } from 'react'
import { componentsLine, itemName, usePosTr } from './i18n'
import { lineUnitPrice } from './logic'
import qrSrc from './pay-qr.jpg'
import S from './styles'
import type { PosLine } from './types'

export default function BillSummary({ orderedItems, grand, onClose, onPay }: {
  orderedItems: PosLine[]
  grand: number
  onClose: () => void
  onPay?: () => void
}) {
  const { tr, lang } = usePosTr()
  const [showQR, setShowQR] = useState(false)

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.receipt} onClick={(e) => e.stopPropagation()}>
        <div style={S.receiptHead}>
          <span style={S.receiptBrand}>{tr('לב ים', 'قلب البحر')}</span>
        </div>

        <div style={S.receiptScroll}>
          {orderedItems.length > 0 && (
            <div style={S.receiptSection}>
              {orderedItems.map((it) => (
                <div key={it.id}>
                  <div style={S.receiptRow}>
                    <span style={S.receiptItemName}>
                      {itemName(it, lang)} <span style={S.receiptQtyTag}>×{it.qty}</span>
                    </span>
                    <span style={S.receiptItemPrice}>{it.qty * lineUnitPrice(it)} ₪</span>
                  </div>
                  {it.components && it.components.length > 0 && (
                    <div style={S.receiptComboParts}>{componentsLine(it.components, lang)}</div>
                  )}
                  {it.note && <div style={S.receiptComboParts}>{'📝 ' + it.note}</div>}
                </div>
              ))}
            </div>
          )}

          {orderedItems.length === 0 && (
            <div style={S.receiptEmpty}>{tr('לא נבחרו פריטים', 'لم يتم اختيار أي طبق')}</div>
          )}
        </div>

        <div style={S.receiptTotal}>
          <span style={S.receiptTotalLbl}>{tr('סה״כ לתשלום', 'الإجمالي للدفع')}</span>
          <span style={S.receiptTotalNum}>
            {grand}
            <span style={S.receiptTotalCur}>₪</span>
          </span>
        </div>

        {showQR && (
          <div style={S.qrPanel}>
            <img src={qrSrc} alt={tr('QR לתשלום', 'QR للدفع')} style={S.qrImg} />
            <span style={S.qrHint}>{tr('סרקו לתשלום מאובטח', 'امسح للدفع الآمن')}</span>
          </div>
        )}

        {onPay && grand > 0 && (
          <button className="pos-tap" style={S.payWide} onClick={onPay}>
            {tr('תשלום וסגירת שולחן', 'الدفع وإغلاق الطاولة')}
          </button>
        )}

        <div style={S.receiptBtns}>
          <button className="pos-tap" style={S.receiptClose} onClick={onClose}>{tr('סגור', 'إغلاق')}</button>
          <button className="pos-tap" style={S.qrBtn} onClick={() => setShowQR((v) => !v)}>
            {showQR ? tr('הסתר QR', 'إخفاء QR') : tr('QR לתשלום', 'QR للدفع')}
          </button>
        </div>
      </div>
    </div>
  )
}
