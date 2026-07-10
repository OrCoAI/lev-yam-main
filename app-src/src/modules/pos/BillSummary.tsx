// Customer-facing bill overlay: open-house cover + included items + paid
// extras, optional payment QR. Ported from pos.html.
import { useState } from 'react'
import { itemName, usePosTr } from './i18n'
import qrSrc from './pay-qr.jpg'
import S from './styles'
import type { PosLine } from './types'

export default function BillSummary({ orderedItems, useOH, headcount, guests, ohCharge, grand, onClose, onPay }: {
  orderedItems: PosLine[]
  useOH: boolean
  headcount: number
  guests: { a: number; c: number }
  ohCharge: number
  grand: number
  onClose: () => void
  onPay?: () => void
}) {
  const { tr, lang } = usePosTr()
  const ohItems = orderedItems.filter((it) => it.oh)
  const extraItems = orderedItems.filter((it) => !it.oh)
  const [showQR, setShowQR] = useState(false)

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.receipt} onClick={(e) => e.stopPropagation()}>
        <div style={S.receiptHead}>
          <span style={S.receiptBrand}>{tr('לב ים', 'قلب البحر')}</span>
        </div>

        <div style={S.receiptScroll}>
          {useOH && headcount > 0 && (
            <div style={S.receiptSection}>
              <div style={S.receiptRow}>
                <span style={S.receiptItemName}>
                  {tr('בית פתוח', 'بيت مفتوح')}
                  <span style={S.receiptItemSub}>
                    {[
                      guests.a > 0 ? guests.a + ' ' + tr('מבוגרים', 'بالغين') : null,
                      guests.c > 0 ? guests.c + ' ' + tr('ילדים', 'أطفال') : null,
                    ].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span style={S.receiptItemPrice}>{ohCharge} ₪</span>
              </div>
            </div>
          )}

          {useOH && ohItems.length > 0 && (
            <div style={S.receiptNote}>{tr('כלול בבית פתוח, ללא תוספת', 'مشمول في البيت المفتوح، بدون إضافة')}:</div>
          )}

          {useOH && ohItems.map((it) => (
            <div key={it.id} style={S.receiptRowSub}>
              <span style={S.receiptItemNameSub}>
                {itemName(it, lang)} <span style={S.receiptQtyTag}>×{it.qty}</span>
              </span>
              <span style={S.receiptItemPriceSub}>—</span>
            </div>
          ))}

          {!useOH && ohItems.map((it) => (
            <div key={it.id} style={S.receiptRow}>
              <span style={S.receiptItemName}>
                {itemName(it, lang)} <span style={S.receiptQtyTag}>×{it.qty}</span>
              </span>
              <span style={S.receiptItemPrice}>{it.qty * it.price} ₪</span>
            </div>
          ))}

          {extraItems.length > 0 && (
            <div style={S.receiptSection}>
              {useOH && <div style={S.receiptNote}>{tr('תוספות בתשלום', 'إضافات بتكلفة')}:</div>}
              {extraItems.map((it) => (
                <div key={it.id}>
                  <div style={S.receiptRow}>
                    <span style={S.receiptItemName}>
                      {itemName(it, lang)} <span style={S.receiptQtyTag}>×{it.qty}</span>
                    </span>
                    <span style={S.receiptItemPrice}>{it.qty * it.price} ₪</span>
                  </div>
                  {it.combo && it.components && it.components.length > 0 && (
                    <div style={S.receiptComboParts}>
                      {it.components.map((c) => itemName(c, lang) + (c.qty ? ' ×' + c.qty : '')).join(' · ')}
                    </div>
                  )}
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
