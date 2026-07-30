// One open table: guests, menu grid with qty steppers, combos, custom items,
// send-to-kitchen, bill summary and payment. Ported from pos.html.
import { useState } from 'react'
import BillSummary from './BillSummary'
import ComboPicker, { type PickerDef } from './ComboPicker'
import { componentsLine, itemName, usePosTr } from './i18n'
import { kitchenCounts, lineCooking, lineOut, lineUnitPrice, tableTotals } from './logic'
import { getComboDefs, getMenuGroups, getMenuItem } from './menuData'
import PaymentModal from './PaymentModal'
import VoidReasonModal from './VoidReasonModal'
import S, { LINE, SUN } from './styles'
import type { ComboComponent, Payment, PosLine, PosPayment, PosTable, SelectedOption } from './types'
import { Line, PosLangToggle, Stepper } from './widgets'

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
  const [draft, setDraft] = useState(() => ({ name: defName(), price: '' }))
  // The picker builds a configured line — a meal (from the meals add-buttons) or a menu
  // item with options/note (from a card's ✎). Both become `combo` lines in the order
  // list; cat/catAr carry the source category for the closed-bill record.
  const [picker, setPicker] = useState<{ def: PickerDef; cat: string; catAr?: string } | null>(null)
  const [pendingVoid, setPendingVoid] = useState<{ it: PosLine; mode: 'line' | 'portion' } | null>(null)

  const paidSoFar = payments.reduce((s, p) => s + p.amount, 0)

  const items = table.items
  const guests = table.guests

  const setItems = (fn: (items: PosLine[]) => PosLine[]) => onUpdate((t) => ({ ...t, items: fn(t.items) }))
  const setGuests = (fn: (g: { a: number; c: number }) => { a: number; c: number }) => onUpdate((t) => ({ ...t, guests: fn(t.guests) }))

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
    // allow an explicit ₪0 item (sometimes needed); still reject a blank/negative price
    if (!draft.name.trim() || Number.isNaN(price) || price < 0) return
    setItems((prev) => [...prev, { id: 'custom-' + Date.now(), name: draft.name.trim(), price, oh: false, cat: 'פריטים שהוספתי', qty: 1, custom: true }])
    setDraft({ name: defName(), price: '' })
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
    // record the void at the option-inclusive unit price so the write-off matches what the guest was charged
    const ok = await onVoidItem(it.name, mode === 'line' ? it.qty || 1 : 1, lineUnitPrice(it), true, reason)
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

  // Confirm the picker: append a configured `combo` line (meal or item-with-options).
  const addConfigured = (p: { def: PickerDef; cat: string; catAr?: string }, result: { components: ComboComponent[]; options: SelectedOption[]; note?: string }) => {
    setItems((prev) => [...prev, {
      id: 'cfg-' + Date.now(), name: p.def.name, nameAr: p.def.nameAr, price: p.def.price,
      oh: false, cat: p.cat, catAr: p.catAr, qty: 1, combo: true,
      components: result.components, options: result.options, note: result.note,
    }])
    setPicker(null)
  }

  // Open the ✎ configure sheet for a grid item: its option groups (if any) + a note.
  const openConfig = (it: PosLine) => {
    const m = getMenuItem(it.name)
    setPicker({
      def: { name: it.name, nameAr: it.nameAr ?? m?.nameAr ?? it.name, price: it.price, includes: m?.includes, options: m?.options ?? [] },
      cat: it.cat, catAr: it.catAr,
    })
  }

  // One row of the order list. Configured lines (combo) carry qty + remove controls and
  // their chosen parts/note; plain sent lines are status-only (their stepper stays on the
  // grid card). Row colour tracks kitchen state: neutral until sent, orange while cooking
  // (sent > done), green once out (done).
  const orderRow = (it: PosLine) => {
    const cooking = lineCooking(it)
    const out = lineOut(it)
    const configured = !!it.combo
    const sub = [componentsLine(it.components, lang), it.note ? '📝 ' + it.note : ''].filter(Boolean).join(' · ')
    return (
      <div key={it.id} style={{ ...S.ksRow, ...(cooking > 0 ? S.ksRowCooking : out > 0 ? S.ksRowOut : {}) }}>
        <div style={S.ksRowMain}>
          <div style={S.ksTop}>
            <span style={S.ksName}>{itemName(it, lang)}{it.qty > 1 && !configured ? ' ×' + it.qty : ''}</span>
            {configured && <span style={S.ksPrice}>{it.qty * lineUnitPrice(it)} ₪</span>}
          </div>
          {sub && <span style={S.ksSub}>{sub}</span>}
          <div style={S.ksChips}>
            {cooking > 0 && <span style={S.ksChipCooking}>{'🍳 ' + tr('במטבח', 'في المطبخ') + ' ×' + cooking}</span>}
            {out > 0 && <span style={S.ksChipOut}>{'✓ ' + tr('הוגש', 'قُدّم') + ' ×' + out}</span>}
            {cooking === 0 && out === 0 && <span style={S.ksChipWait}>{tr('טרם נשלח', 'لم يُرسل')}</span>}
          </div>
        </div>
        {configured && (
          <div style={S.ksCtl}>
            <button className="pos-tap" style={{ ...S.qBtn, opacity: it.qty <= 1 ? 0.35 : 1 }} onClick={() => it.qty > 1 && setQty(it.id, -1)}>–</button>
            <span style={{ ...S.qNum, color: SUN }}>{it.qty}</span>
            <button className="pos-tap" style={{ ...S.qBtn, background: SUN, color: '#fff', borderColor: 'transparent' }} onClick={() => setQty(it.id, 1)}>+</button>
            <button className="pos-tap" style={S.delBtn} onClick={() => removeItem(it)}>✕</button>
          </div>
        )}
      </div>
    )
  }

  const { menuAll, headcount, grand, itemsCount } = tableTotals(table)
  const tableLabel = (table.name ? table.name + ' · ' : '') + tr('שולחן', 'طاولة') + ' ' + table.num

  // Grid = the menu only. Plain items get a stepper card; configured lines (combo)
  // never appear here — they live in the order list below (owner 2026-07-29).
  const baseGroups = getMenuGroups().map((g) => ({ cat: g.cat, catAr: g.catAr, custom: false, items: items.filter((it) => it.cat === g.cat && !it.combo) })).filter((g) => g.items.length)
  const customItems = items.filter((it) => it.custom)
  const groups = customItems.length ? [...baseGroups, { cat: 'פריטים שהוספתי', catAr: 'أصناف أضفتها', custom: true, items: customItems }] : baseGroups
  const k = kitchenCounts(items) // cooking / ready / served / unsent snapshot for this table
  // The order list (below the grid): every configured line always, plus any plain line
  // once it's been sent. Kept in item order so it never reshuffles. Per the owner's
  // model, `done` = out/delivered (green); a line is orange while sent > done.
  const orderLines = items.filter((it) => it.combo || (it.sent || 0) > 0)

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

        {/* Meals — configured lines + add cards */}
        <section style={S.section}>
          <header style={S.catHead}>
            <span style={{ ...S.catDot, background: SUN }} />
            <h2 style={S.catTitle}>{tr('ארוחות', 'وجبات')}</h2>
            <span style={S.catTag}>{tr('בחירת מרכיבים', 'اختيار المكوّنات')}</span>
          </header>
          <div style={S.comboAddRow}>
            {getComboDefs().map((def) => (
              <button key={def.name} className="pos-tap" style={S.comboAddBtn}
                onClick={() => setPicker({ def, cat: def.cat, catAr: def.catAr })}>
                <span style={S.comboAddName}>{tr(def.name, def.nameAr)}</span>
                <span style={S.comboAddPrice}>{'+ ' + def.price + ' ₪'}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Menu grid — quick-add steppers + ✎ to configure (configured lines go to the order list) */}
        {groups.map((g) => (
          <section key={g.cat} style={S.section}>
            <header style={S.catHead}>
              <span style={{ ...S.catDot, background: SUN }} />
              <h2 style={S.catTitle}>{tr(g.cat, g.catAr)}</h2>
            </header>
            <div style={S.grid}>
              {g.items.map((it) => (
                <article
                  key={it.id}
                  style={{ ...S.card,
                    borderColor: it.qty > 0 ? SUN : LINE,
                    boxShadow: it.qty > 0 ? '0 2px 10px rgba(232,131,58,.18)' : 'none',
                  }}
                >
                  <div style={S.cardTop}>
                    <span style={S.cardNameWrap}>
                      <span style={S.cardName}>{itemName(it, lang)}</span>
                    </span>
                    {it.custom
                      ? <button className="pos-tap" style={S.delBtn} onClick={() => removeItem(it)}>✕</button>
                      : <span style={{ ...S.cardPrice, color: SUN }}>{it.price}</span>}
                  </div>
                  {it.custom && <div style={{ ...S.cardPrice, color: SUN, fontSize: 13, marginTop: -6, marginBottom: 8 }}>{it.price} ₪</div>}
                  <div style={S.cardCtl}>
                    <button className="pos-tap" style={{ ...S.qBtn, opacity: it.qty === 0 ? 0.35 : 1 }} onClick={() => setQty(it.id, -1)}>–</button>
                    <span style={{ ...S.qNum, color: it.qty > 0 ? SUN : '#cfc6b6' }}>{it.qty}</span>
                    <button className="pos-tap" style={{ ...S.qBtn, background: SUN, color: '#fff', borderColor: 'transparent' }} onClick={() => setQty(it.id, 1)}>+</button>
                  </div>
                  {!it.custom && (
                    <button className="pos-tap" style={S.cardConfig} onClick={() => openConfig(it)}>
                      {'✎ ' + (getMenuItem(it.name)?.options?.length ? tr('תוספות / הערה', 'إضافات / ملاحظة') : tr('הערה', 'ملاحظة'))}
                    </button>
                  )}
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
            </div>
            <div style={S.addBtns}>
              <button className="pos-tap" style={S.addCancel} onClick={() => { setAdding(false); setDraft({ name: defName(), price: '' }) }}>{tr('ביטול', 'إلغاء')}</button>
              <button className="pos-tap" style={S.addConfirm} onClick={addCustom}>{tr('הוסף', 'إضافة')}</button>
            </div>
          </div>
        ) : (
          <button className="pos-tap" style={S.addOpen} onClick={() => setAdding(true)}>{'+ ' + tr('הוספת פריט', 'إضافة صنف')}</button>
        )}

        {/* The order — configured lines + sent items in one place, below the grid so
            the menu never shifts. Orange = in the kitchen, green = out. */}
        {orderLines.length > 0 && (
          <section style={S.section}>
            <header style={S.catHead}>
              <span style={{ ...S.catDot, background: SUN }} />
              <h2 style={S.catTitle}>{tr('ההזמנה', 'الطلب')}</h2>
              <span style={S.catTag}>{tr('סטטוס מטבח', 'حالة المطبخ')}</span>
            </header>
            {orderLines.map(orderRow)}
          </section>
        )}

        <div style={{ height: 160 }} />
      </div>

      {/* DOCK */}
      <div style={S.dock}>
        <div style={S.billRow}>
          <div style={S.breakdown}>
            <Line label={tr('תפריט', 'قائمة') + ' · ' + itemsCount + ' ' + tr('פריטים', 'أصناف')} val={menuAll} />
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
          grand={grand}
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
      {picker && (
        <ComboPicker
          def={picker.def}
          onCancel={() => setPicker(null)}
          onConfirm={(result) => addConfigured(picker, result)}
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
