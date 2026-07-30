// Options picker: builds a meal or an options-carrying item from its option
// groups — choose-one, count (N free then priced), and optional add — so the
// chosen parts + their charges travel with the line (bill, kitchen, server).
import { useState } from 'react'
import { itemName, usePosTr } from './i18n'
import type { MenuOptionGroup } from './menu'
import S, { SEA } from './styles'
import type { ComboComponent, SelectedOption } from './types'

export interface PickerDef {
  name: string
  nameAr: string
  price: number
  includes?: { name: string; nameAr: string }[]
  options: MenuOptionGroup[]
}

export default function ComboPicker({ def, onCancel, onConfirm }: {
  def: PickerDef
  onCancel: () => void
  onConfirm: (result: { components: ComboComponent[]; options: SelectedOption[]; unitPrice: number; note?: string }) => void
}) {
  const { tr, lang } = usePosTr()
  const groups = def.options || []
  const includes = def.includes || []
  // A required choice must have options to be satisfiable; a misconfigured empty group
  // (created in the menu editor before its options were added) must not lock the picker.
  const requiredChoiceGroups = groups.filter((g) => g.kind === 'choice' && g.min >= 1 && g.options.length > 0)

  // choose-one → picked option id per group; add → set of option ids; count → qty per group
  const [pick, setPick] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    requiredChoiceGroups.forEach((g) => { if (g.options[0]) init[g.id] = g.options[0].id })
    return init
  })
  const [adds, setAdds] = useState<Set<string>>(new Set())
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    groups.filter((g) => g.kind === 'count').forEach((g) => { init[g.id] = g.min })
    return init
  })
  const [note, setNote] = useState('')

  const toggleAdd = (id: string) => setAdds((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const setCount = (g: MenuOptionGroup, v: number) =>
    setCounts((prev) => ({ ...prev, [g.id]: Math.max(g.min, Math.min(g.max, v)) }))

  // one pass over the groups → selected options (with charge) + display components
  const buildResult = () => {
    const options: SelectedOption[] = []
    const components: ComboComponent[] = includes.map((c) => ({ name: c.name, nameAr: c.nameAr }))
    groups.forEach((g) => {
      if (g.kind === 'choice') {
        const o = g.options.find((x) => x.id === pick[g.id])
        if (o) { options.push({ id: o.id, name: o.name, nameAr: o.nameAr, price: o.price }); components.push({ slot: g.name, slotAr: g.nameAr, name: o.name, nameAr: o.nameAr }) }
      } else if (g.kind === 'add') {
        g.options.forEach((o) => { if (adds.has(o.id)) { options.push({ id: o.id, name: o.name, nameAr: o.nameAr, price: o.price }); components.push({ slot: g.name, slotAr: g.nameAr, name: o.name, nameAr: o.nameAr }) } })
      } else { // count
        const o = g.options[0]; const qty = counts[g.id] || 0
        if (o && qty > 0) {
          const charge = Math.max(0, qty - g.included) * o.price
          options.push({ id: o.id, name: o.name, nameAr: o.nameAr, qty, price: charge })
          components.push({ slot: g.name, slotAr: g.nameAr, name: o.name, nameAr: o.nameAr, qty })
        }
      }
    })
    return { options, components, unitPrice: def.price + options.reduce((s, o) => s + o.price, 0), note: note.trim() || undefined }
  }

  const result = buildResult()
  const valid = requiredChoiceGroups.every((g) => pick[g.id])
  const priceTag = (p: number) => (p > 0 ? ' +' + p + ' ₪' : '')

  return (
    <div style={S.overlay} onClick={onCancel}>
      <div style={S.receipt} onClick={(e) => e.stopPropagation()}>
        <div style={S.payHead}>
          <div style={S.payTotalLbl}>{tr('בחירת מרכיבים', 'اختيار المكوّنات')}</div>
          <div style={S.payTotalBig}>{tr(def.name, def.nameAr)}</div>
          <div style={S.payHeadNote}>{result.unitPrice} ₪</div>
        </div>

        <div style={S.comboBody}>
          {includes.length > 0 && (
            <div style={S.comboIncludes}>
              {tr('כולל', 'يشمل') + ': ' + includes.map((c) => itemName(c, lang)).join(' · ')}
            </div>
          )}
          {groups.map((g) => (
            <div key={g.id} style={S.comboSlot}>
              <div style={S.comboSlotLbl}>
                {tr(g.name, g.nameAr)}
                {g.kind === 'count' && <span style={S.comboSlotHint}> ({g.min + '–' + g.max}{g.included > 0 ? ' · ' + tr(g.included + ' חינם', g.included + ' مجاناً') : ''})</span>}
              </div>
              {g.kind === 'count' ? (
                <div style={S.comboStepper}>
                  <button className="pos-tap" style={{ ...S.qBtn, opacity: (counts[g.id] || 0) <= g.min ? 0.35 : 1 }} onClick={() => setCount(g, (counts[g.id] || 0) - 1)}>–</button>
                  <span style={S.qNum}>{counts[g.id] || 0}</span>
                  <button className="pos-tap" style={{ ...S.qBtn, background: SEA, color: '#fff', borderColor: 'transparent' }} onClick={() => setCount(g, (counts[g.id] || 0) + 1)}>+</button>
                  {g.options[0]?.price > 0 && <span style={S.comboSlotHint}>{'+' + g.options[0].price + ' ₪ ' + tr('ליחידה', 'للوحدة')}</span>}
                </div>
              ) : (
                <div style={S.comboOpts}>
                  {g.options.map((o) => {
                    const on = g.kind === 'add' ? adds.has(o.id) : pick[g.id] === o.id
                    return (
                      <button key={o.id} className="pos-tap" style={{ ...S.comboChip, ...(on ? S.payChipOn : {}) }}
                        onClick={() => (g.kind === 'add' ? toggleAdd(o.id) : setPick((p) => ({ ...p, [g.id]: o.id })))}>
                        {itemName(o, lang) + priceTag(o.price)}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
          <div style={S.comboSlot}>
            <div style={S.comboSlotLbl}>{tr('הערה למטבח', 'ملاحظة للمطبخ')}</div>
            <input
              style={S.addInput}
              placeholder={tr('לדוגמה: בלי לימון, חריף', 'مثال: بدون ليمون، حار')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <div style={S.payBtns}>
          <button className="pos-tap" style={S.receiptClose} onClick={onCancel}>{tr('ביטול', 'إلغاء')}</button>
          <button
            className="pos-tap"
            style={{ ...S.payConfirm, background: valid ? '#3a9e6e' : '#cfc6b6', color: '#fff', cursor: valid ? 'pointer' : 'not-allowed' }}
            disabled={!valid}
            onClick={() => valid && onConfirm(result)}
          >
            {tr('הוספה לשולחן', 'إضافة للطاولة') + ' · ' + result.unitPrice + ' ₪'}
          </button>
        </div>
      </div>
    </div>
  )
}
