// One open table: guests, menu grid with qty steppers, combos, custom items,
// send-to-kitchen, bill summary and payment. Ported from pos.html.
import { useState } from 'react'
import BillSummary from './BillSummary'
import ComboPicker from './ComboPicker'
import { itemName, usePosTr } from './i18n'
import { kitchenCounts, tableTotals } from './logic'
import { COMBO_DEFS, MENU, type FlatComboDef } from './menu'
import PaymentModal from './PaymentModal'
import S, { LINE, SEA, SEA_DEEP, SUN } from './styles'
import type { ComboComponent, Payment, PosLine, PosTable } from './types'
import { KitchenChips, Line, PosLangToggle, StatusChip, Stepper } from './widgets'

export default function TableView({ table, onUpdate, onBack, onPaid, onCancelTable, onFire }: {
  table: PosTable
  onUpdate: (updater: (t: PosTable) => PosTable) => void
  onBack: () => void
  onPaid: (payment: Payment) => void
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

  const items = table.items
  const guests = table.guests
  const useOH = table.useOH

  const setItems = (fn: (items: PosLine[]) => PosLine[]) => onUpdate((t) => ({ ...t, items: fn(t.items) }))
  const setGuests = (fn: (g: { a: number; c: number }) => { a: number; c: number }) => onUpdate((t) => ({ ...t, guests: fn(t.guests) }))
  const setUseOH = (v: boolean) => onUpdate((t) => ({ ...t, useOH: v }))

  const setQty = (id: string, d: number) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, qty: Math.max(0, it.qty + d) } : it)))

  const addCustom = () => {
    const price = parseInt(draft.price, 10)
    if (!draft.name.trim() || !price) return
    setItems((prev) => [...prev, { id: 'custom-' + Date.now(), name: draft.name.trim(), price, oh: draft.oh, cat: 'פריטים שהוספתי', qty: 1, custom: true }])
    setDraft({ name: defName(), price: '', oh: false })
    setAdding(false)
  }

  const removeItem = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id))

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
                <button className="pos-tap" style={S.delBtn} onClick={() => removeItem(it.id)}>✕</button>
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
                      ? <button className="pos-tap" style={S.delBtn} onClick={() => removeItem(it.id)}>✕</button>
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
          total={grand} tableLabel={tableLabel}
          onCancel={() => setShowPay(false)}
          onConfirm={(payment) => { setShowPay(false); onPaid(payment) }}
        />
      )}
      {comboPick && (
        <ComboPicker
          def={comboPick}
          onCancel={() => setComboPick(null)}
          onConfirm={(components) => addCombo(comboPick, components)}
        />
      )}
    </div>
  )
}
