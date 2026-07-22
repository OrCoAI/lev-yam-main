// One open table: guests, menu grid with qty steppers, combos, custom items,
// send-to-kitchen, bill summary and payment. Ported from pos.html.
import { useState } from 'react'
import BillSummary from './BillSummary'
import ComboPicker from './ComboPicker'
import { itemName, usePosTr } from './i18n'
import { kitchenCounts, tableTotals } from './logic'
import { COMBO_DEFS, MENU, type FlatComboDef } from './menu'
import PaymentModal from './PaymentModal'
import VoidReasonModal from './VoidReasonModal'
import S, { LINE, SEA, SEA_DEEP, SUN } from './styles'
import type { ComboComponent, Payment, PosLine, PosPayment, PosTable } from './types'
import { KitchenChips, Line, PosLangToggle, StatusChip, Stepper } from './widgets'

export default function TableView({ table, payments, canManage, onUpdate, onBack, onPaid, onRecordPayment, onVoidPayment, onEditPayment, onVoidItem, onCancelTable, onFire }: {
  table: PosTable
  payments: PosPayment[]
  canManage: boolean
  onUpdate: (updater: (t: PosTable) => PosTable) => void
  onBack: () => void
  onPaid: (payment: Payment) => void
  onRecordPayment: (payments: { method: 'cash' | 'card'; amount: number }[]) => void
  onVoidPayment: (paymentId: number) => void
  onEditPayment: (paymentId: number, method: 'cash' | 'card', amount: number) => void
  onVoidItem: (name: string, qty: number, unitPrice: number, wasFired: boolean, reason: string) => Promise<boolean>
  onCancelTable: () => void
  onFire: () => void
}) {
  const { tr, lang } = usePosTr()
  const defName = () => tr('שתייה קרה', 'مشروب بارد')
  const [adding, setAdding] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [showPay, setShowPay] = useState(false)
  const [draft, setDraft] = useState(() => ({ name: defName(), price: '', oh: false }))
  const [comboPick, setComboPick] = useState<FlatComboDef | null>(null)
  const [pendingVoid, setPendingVoid] = useState<{ it: PosLine; mode: 'line' | 'portion' } | null>(null)

  const paidSoFar = payments.reduce((s, p) => s + p.amount, 0)

  const items = table.items
  const guests = table.guests
  const useOH = table.useOH

  const setItems = (fn: (items: PosLine[]) => PosLine[]) => onUpdate((t) => ({ ...t, items: fn(t.items) }))
  const setGuests = (fn: (g: { a: number; c: number }) => { a: number; c: number }) => onUpdate((t) => ({ ...t, guests: fn(t.guests) }))
  const setUseOH = (v: boolean) => onUpdate((t) => ({ ...t, useOH: v }))

  // Decrementing below what's already been sent to the kitchen removes a cooked
  // portion → goes through the void flow; un-fired portions decrement freely.
  const setQty = (id: string, d: number) => {
    const it = items.find((x) => x.id === id)
    if (!it) return
    if (d < 0 && it.qty - 1 < (it.sent || 0)) { requestVoid(it, 'portion'); return }
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, qty: Math.max(0, x.qty + d) } : x)))
  }

  const addCustom = () => {
    const price = parseInt(draft.price, 10)
    if (!draft.name.trim() || !price) return
    setItems((prev) => [...prev, { id: 'custom-' + Date.now(), name: draft.name.trim(), price, oh: draft.oh, cat: 'פריטים שהוספתי', qty: 1, custom: true }])
    setDraft({ name: defName(), price: '', oh: false })
    setAdding(false)
  }

  // Voiding a fired item is a written-off cost: managers only, with a structured
  // reason (VoidReasonModal). requestVoid opens the picker; confirmVoid runs the
  // audited void and applies the local change only if it's accepted server-side.
  const requestVoid = (it: PosLine, mode: 'line' | 'portion') => {
    if (!canManage) {
      alert(tr('פריט שנשלח למטבח — נדרש מנהל להסרה', 'صنف أُرسل للمطبخ — يلزم مدير للحذف'))
      return
    }
    setPendingVoid({ it, mode })
  }
  const confirmVoid = async (reason: string) => {
    if (!pendingVoid) return
    const { it, mode } = pendingVoid
    setPendingVoid(null)
    const ok = await onVoidItem(it.name, mode === 'line' ? it.qty || 1 : 1, it.price, true, reason)
    if (!ok) return
    if (mode === 'line') {
      setItems((prev) => prev.filter((x) => x.id !== it.id))
    } else {
      setItems((prev) => prev.map((x) => {
        if (x.id !== it.id) return x
        const sent = Math.max(0, (x.sent || 0) - 1)
        return { ...x, qty: x.qty - 1, sent, done: Math.min(x.done || 0, sent), served: Math.min(x.served || 0, sent) }
      }))
    }
  }

  // Remove a whole line. An un-fired line never reached the kitchen (no cost) —
  // drop it locally with no round-trip (venue Wi-Fi is flaky). A fired line goes
  // through the void reason picker and is dropped only if the void is accepted.
  const removeItem = (it: PosLine) => {
    if ((it.sent || 0) <= 0) { setItems((prev) => prev.filter((x) => x.id !== it.id)); return }
    requestVoid(it, 'line')
  }

  const addCombo = (def: FlatComboDef, components: ComboComponent[]) => {
    setItems((prev) => [...prev, {
      id: 'combo-' + Date.now(), name: def.name, nameAr: def.nameAr, price: def.price,
      oh: def.oh, cat: def.cat, catAr: def.catAr, qty: 1, combo: true, components,
    }])
    setComboPick(null)
  }

  const { extras, menuAll, headcount, ohCharge, grand, itemsCount } = tableTotals(table)
  const tableLabel = (table.name ? table.name + ' · ' : '') + tr('שולחן', 'طاولة') + ' ' + table.num

  const baseGroups = MENU.map((g) => ({ cat: g.cat, catAr: g.catAr, oh: g.oh, custom: false, items: items.filter((it) => it.cat === g.cat && !it.combo) })).filter((g) => g.items.length)
  const customItems = items.filter((it) => it.custom)
  const comboItems = items.filter((it) => it.combo)
  const groups = customItems.length ? [...baseGroups, { cat: 'פריטים שהוספתי', catAr: 'أصناف أضفتها', oh: false, custom: true, items: customItems }] : baseGroups
  const k = kitchenCounts(items) // cooking / ready / served / unsent snapshot for this table

  return (
    <div style={S.app}>
      {/* HEADER */}
      <div style={S.tvHead}>
        <div style={S.tvTopRow}>
          <button className="pos-tap" style={S.backBtn} onClick={onBack}>{'→ ' + tr('שולחנות', 'الطاولات')}</button>
          <span style={S.tvTitle}>{tr('שולחן', 'طاولة') + ' ' + table.num}</span>
          <PosLangToggle />
          <button
            className="pos-tap"
            style={S.cancelTableBtn}
            onClick={() => {
              if (window.confirm(tr('לבטל ולמחוק את השולחן? ההזמנה לא תישמר.', 'إلغاء وحذف الطاولة؟ لن يتم حفظ الطلب.'))) onCancelTable()
            }}
          >✕</button>
        </div>
        <input
          style={S.nameInput}
          placeholder={tr('שם / הערה (אופציונלי)', 'اسم / ملاحظة (اختياري)')}
          value={table.name}
          onChange={(e) => onUpdate((t) => ({ ...t, name: e.target.value }))}
        />
      </div>

      {/* SCROLL AREA */}
      <div style={S.scroll}>
        <div style={S.guestRow}>
          <Stepper label={tr('מבוגרים', 'بالغين')} value={guests.a}
            onMinus={() => setGuests((g) => ({ ...g, a: Math.max(0, g.a - 1) }))}
            onPlus={() => setGuests((g) => ({ ...g, a: g.a + 1 }))} />
          <Stepper label={tr('ילדים', 'أطفال')} value={guests.c}
            onMinus={() => setGuests((g) => ({ ...g, c: Math.max(0, g.c - 1) }))}
            onPlus={() => setGuests((g) => ({ ...g, c: g.c + 1 }))} />
          <div style={S.headTotal}>
            {headcount > 4 && <span style={S.familyTag}>{tr('משפחה', 'عائلة')}</span>}
            <span style={S.headTotalNum}>{headcount}</span>
            <span style={S.headTotalLbl}>{tr('סועדים', 'ضيوف')}</span>
          </div>
        </div>

        {/* Kitchen state for the whole table: what's cooking, out and waiting, and served */}
        {(k.cooking > 0 || k.ready > 0 || k.served > 0) && (
          <div style={S.kitchenStrip}>
            <KitchenChips cooking={k.cooking} ready={k.ready} served={k.served} emoji />
          </div>
        )}

        {/* Balance due — shown once any partial payment has been taken */}
        {paidSoFar > 0 && (
          <div style={S.balanceBox}>
            <div style={S.balanceRow}>
              <span style={S.balanceLbl}>{tr('סה״כ', 'المجموع')}</span>
              <span style={S.balanceVal}>{grand} ₪</span>
            </div>
            <div style={S.balanceRow}>
              <span style={S.balanceLbl}>{tr('שולם', 'مدفوع')}</span>
              <span style={S.balanceVal}>{paidSoFar} ₪</span>
            </div>
            <div style={S.balanceRow}>
              <span style={S.balanceLbl}>{tr('נותר לתשלום', 'المتبقي للدفع')}</span>
              <span style={S.balanceDue}>{Math.max(0, grand - paidSoFar)} ₪</span>
            </div>
            {payments.map((p) => (
              <div key={p.id} style={S.payHistRow}>
                <span style={S.payHistMethod}>{p.method === 'cash' ? tr('מזומן', 'نقداً') : tr('אשראי', 'بطاقة')}</span>
                {p.note && <span style={S.balanceLbl}>· {p.note}</span>}
                {canManage ? (
                  <button className="pos-tap" style={{ ...S.payHistAmt, ...S.payHistEdit }}
                    title={tr('עריכת סכום', 'تعديل المبلغ')}
                    onClick={() => {
                      const v = window.prompt(tr('סכום התשלום', 'مبلغ الدفعة'), String(p.amount))
                      const n = v == null ? NaN : parseInt(v, 10)
                      if (n > 0) onEditPayment(p.id, p.method, n)
                    }}>{p.amount} ₪ ✎</button>
                ) : (
                  <span style={S.payHistAmt}>{p.amount} ₪</span>
                )}
                {canManage && (
                  <button className="pos-tap" style={S.payHistVoid}
                    title={tr('ביטול תשלום', 'إلغاء الدفعة')}
                    onClick={() => { if (window.confirm(tr('לבטל את התשלום?', 'إلغاء الدفعة؟'))) onVoidPayment(p.id) }}>✕</button>
                )}
              </div>
            ))}
            <button className="pos-tap" style={S.addPayBtn} onClick={() => setShowPay(true)}>
              {'+ ' + tr('תשלום נוסף', 'دفعة إضافية')}
            </button>
          </div>
        )}

        {/* Combos / meals — configured lines + add cards */}
        <section style={S.section}>
          <header style={S.catHead}>
            <span style={{ ...S.catDot, background: SUN }} />
            <h2 style={S.catTitle}>{tr('ארוחות', 'وجبات')}</h2>
            <span style={S.catTag}>{tr('בחירת מרכיבים', 'اختيار المكوّنات')}</span>
          </header>
          {comboItems.map((it) => (
            <div key={it.id} style={S.comboLine}>
              <div style={S.comboLineTop}>
                <span style={S.comboLineName}>{itemName(it, lang)}</span>
                <StatusChip it={it} />
                <span style={S.comboLinePrice}>{it.qty * it.price} ₪</span>
                <button className="pos-tap" style={S.delBtn} onClick={() => removeItem(it)}>✕</button>
              </div>
              {it.components && it.components.length > 0 && (
                <div style={S.comboLineParts}>
                  {it.components.map((c, ci) => (
                    <span key={ci} style={S.comboPart}>{itemName(c, lang) + (c.qty ? ' ×' + c.qty : '')}</span>
                  ))}
                </div>
              )}
              <div style={S.comboLineCtl}>
                <button className="pos-tap" style={{ ...S.qBtn, opacity: it.qty <= 1 ? 0.35 : 1 }} onClick={() => it.qty > 1 && setQty(it.id, -1)}>–</button>
                <span style={{ ...S.qNum, color: SUN }}>{it.qty}</span>
                <button className="pos-tap" style={{ ...S.qBtn, background: SUN, color: '#fff', borderColor: 'transparent' }} onClick={() => setQty(it.id, 1)}>+</button>
              </div>
            </div>
          ))}
          <div style={S.comboAddRow}>
            {COMBO_DEFS.map((def) => (
              <button key={def.name} className="pos-tap" style={S.comboAddBtn} onClick={() => setComboPick(def)}>
                <span style={S.comboAddName}>{tr(def.name, def.nameAr)}</span>
                <span style={S.comboAddPrice}>{'+ ' + def.price + ' ₪'}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Menu sections */}
        {groups.map((g) => (
          <section key={g.cat} style={S.section}>
            <header style={S.catHead}>
              <span style={{ ...S.catDot, background: g.oh ? SEA : SUN }} />
              <h2 style={S.catTitle}>{tr(g.cat, g.catAr)}</h2>
              <span style={S.catTag}>{g.oh ? tr('בית פתוח', 'بيت مفتوح') : tr('בתשלום', 'بتكلفة')}</span>
            </header>
            <div style={S.grid}>
              {g.items.map((it) => (
                <article
                  key={it.id}
                  style={{ ...S.card,
                    borderColor: it.qty > 0 ? (it.oh ? SEA : SUN) : LINE,
                    boxShadow: it.qty > 0 ? '0 2px 10px ' + (it.oh ? 'rgba(44,146,191,.18)' : 'rgba(232,131,58,.18)') : 'none',
                  }}
                >
                  <div style={S.cardTop}>
                    <span style={S.cardNameWrap}>
                      <span style={S.cardName}>{itemName(it, lang)}</span>
                      {it.qty > 0 && <StatusChip it={it} />}
                    </span>
                    {it.custom
                      ? <button className="pos-tap" style={S.delBtn} onClick={() => removeItem(it)}>✕</button>
                      : <span style={{ ...S.cardPrice, color: it.oh ? SEA_DEEP : SUN }}>{it.price}</span>}
                  </div>
                  {it.custom && <div style={{ ...S.cardPrice, color: SUN, fontSize: 13, marginTop: -6, marginBottom: 8 }}>{it.price} ₪</div>}
                  <div style={S.cardCtl}>
                    <button className="pos-tap" style={{ ...S.qBtn, opacity: it.qty === 0 ? 0.35 : 1 }} onClick={() => setQty(it.id, -1)}>–</button>
                    <span style={{ ...S.qNum, color: it.qty > 0 ? (it.oh ? SEA : SUN) : '#cfc6b6' }}>{it.qty}</span>
                    <button className="pos-tap" style={{ ...S.qBtn, background: it.oh ? SEA : SUN, color: '#fff', borderColor: 'transparent' }} onClick={() => setQty(it.id, 1)}>+</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

        {/* Add custom item */}
        {adding ? (
          <div style={S.addForm}>
            <input style={S.addInput} placeholder={tr('שם הפריט', 'اسم الصنف')} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
            <div style={S.addRow}>
              <input style={{ ...S.addInput, flex: 1 }} type="number" inputMode="numeric" placeholder={tr('מחיר ₪', 'السعر ₪')} value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
              <button className="pos-tap" style={{ ...S.ohPick, ...(draft.oh ? S.ohPickOn : {}) }} onClick={() => setDraft({ ...draft, oh: !draft.oh })}>
                {draft.oh ? tr('בית פתוח', 'بيت مفتوح') : tr('בתשלום', 'بتكلفة')}
              </button>
            </div>
            <div style={S.addBtns}>
              <button className="pos-tap" style={S.addCancel} onClick={() => { setAdding(false); setDraft({ name: defName(), price: '', oh: false }) }}>{tr('ביטול', 'إلغاء')}</button>
              <button className="pos-tap" style={S.addConfirm} onClick={addCustom}>{tr('הוסף', 'إضافة')}</button>
            </div>
          </div>
        ) : (
          <button className="pos-tap" style={S.addOpen} onClick={() => setAdding(true)}>{'+ ' + tr('הוספת פריט', 'إضافة صنف')}</button>
        )}

        <div style={{ height: 160 }} />
      </div>

      {/* DOCK */}
      <div style={S.dock}>
        <div style={S.modeRow}>
          <button className="pos-tap" style={{ ...S.modeBtn, ...(useOH ? S.modeOn : {}) }} onClick={() => setUseOH(true)}>{tr('בית פתוח', 'بيت مفتوح')}</button>
          <button className="pos-tap" style={{ ...S.modeBtn, ...(!useOH ? S.modeOnSun : {}) }} onClick={() => setUseOH(false)}>{tr('לפי תפריט', 'حسب القائمة')}</button>
        </div>
        <div style={S.billRow}>
          <div style={S.breakdown}>
            {useOH ? (
              <>
                <Line label={tr('בית פתוח', 'بيت مفتوح') + ' · ' + headcount + ' ' + tr('סועדים', 'ضيوف')} val={ohCharge} />
                {extras > 0 && <Line label={tr('תוספות', 'إضافات')} val={extras} />}
              </>
            ) : (
              <Line label={tr('תפריט', 'قائمة') + ' · ' + itemsCount + ' ' + tr('פריטים', 'أصناف')} val={menuAll} />
            )}
          </div>
          <div style={S.grand}>
            <span style={S.grandLbl}>{tr('לתשלום', 'للدفع')}</span>
            <span style={S.grandNum}>
              {grand}
              <span style={S.grandCur}>₪</span>
            </span>
          </div>
        </div>
        <button
          className="pos-tap"
          style={{ ...S.fireBtn, ...(k.unsent ? {} : S.fireBtnDone) }}
          disabled={!k.unsent}
          onClick={() => k.unsent && onFire()}
        >
          {k.unsent ? tr('שלח למטבח', 'أرسل للمطبخ') + ' · ' + k.unsent : tr('נשלח למטבח', 'أُرسل للمطبخ') + ' ✓'}
        </button>
        <div style={S.dockBtns}>
          <button className="pos-tap" style={S.resetBtn} onClick={() => setShowSummary(true)}>{tr('חשבון', 'الحساب')}</button>
          <button className="pos-tap" style={S.payBtn} onClick={() => setShowPay(true)}>{tr('תשלום וסגירה', 'الدفع والإغلاق')}</button>
        </div>
      </div>

      {/* OVERLAYS */}
      {showSummary && (
        <BillSummary
          orderedItems={items.filter((it) => it.qty > 0)}
          useOH={useOH} headcount={headcount} guests={guests}
          ohCharge={ohCharge} grand={grand}
          onClose={() => setShowSummary(false)}
          onPay={() => { setShowSummary(false); setShowPay(true) }}
        />
      )}
      {showPay && (
        <PaymentModal
          total={grand} alreadyPaid={paidSoFar} tableLabel={tableLabel}
          onCancel={() => setShowPay(false)}
          onRecord={(pmts) => { setShowPay(false); onRecordPayment(pmts) }}
          onPaid={(payment) => { setShowPay(false); onPaid(payment) }}
        />
      )}
      {comboPick && (
        <ComboPicker
          def={comboPick}
          onCancel={() => setComboPick(null)}
          onConfirm={(components) => addCombo(comboPick, components)}
        />
      )}
      {pendingVoid && (
        <VoidReasonModal
          label={itemName(pendingVoid.it, lang)}
          onCancel={() => setPendingVoid(null)}
          onConfirm={confirmVoid}
        />
      )}
    </div>
  )
}
