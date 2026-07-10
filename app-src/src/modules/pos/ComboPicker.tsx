// Lets staff build a combo (e.g. עסקית דג) from its component slots, so the
// chosen parts travel with the line item — clear for the bill and the chef view.
import { Fragment, useState } from 'react'
import { itemName, usePosTr } from './i18n'
import type { FlatComboDef } from './menu'
import S, { SEA } from './styles'
import type { ComboComponent } from './types'

export default function ComboPicker({ def, onCancel, onConfirm }: {
  def: FlatComboDef
  onCancel: () => void
  onConfirm: (components: ComboComponent[]) => void
}) {
  const { tr, lang } = usePosTr()
  const slots = def.combo.slots || []
  const includes = def.combo.includes || []
  const [sel, setSel] = useState<Record<number, number>>(() => {
    // choice slot → option index; count slot → number
    const init: Record<number, number> = {}
    slots.forEach((s, i) => { if (s.count) init[i] = s.min || 0 })
    return init
  })
  const [otherText, setOtherText] = useState<Record<number, string>>({}) // "אחר" free-text per slot

  const pickOption = (i: number, oi: number) => setSel((prev) => ({ ...prev, [i]: oi }))
  const setCount = (i: number, v: number, s: (typeof slots)[number]) =>
    setSel((prev) => ({ ...prev, [i]: Math.max(s.min || 0, Math.min(s.max ?? 99, v)) }))

  const choiceSlots = slots.map((s, i) => ({ s, i })).filter((x) => !x.s.count)
  const valid = choiceSlots.every(({ s, i }) => {
    const oi = sel[i]
    if (oi == null) return false
    const opt = s.options?.[oi]
    return !(opt && opt.other && !(otherText[i] || '').trim())
  })

  const build = () => {
    if (!valid) return
    const components: ComboComponent[] = []
    includes.forEach((c) => components.push({ name: c.name, nameAr: c.nameAr }))
    slots.forEach((s, i) => {
      if (s.count) {
        const n = sel[i] || 0
        if (n > 0) components.push({ slot: s.name, slotAr: s.nameAr, name: s.unit!, nameAr: s.unitAr, qty: n })
        return
      }
      const opt = s.options?.[sel[i]]
      if (!opt) return
      const txt = (otherText[i] || '').trim()
      components.push({
        slot: s.name, slotAr: s.nameAr,
        name: opt.other ? opt.name + ' · ' + txt : opt.name,
        nameAr: opt.other ? opt.nameAr + ' · ' + txt : opt.nameAr,
      })
    })
    onConfirm(components)
  }

  return (
    <div style={S.overlay} onClick={onCancel}>
      <div style={S.receipt} onClick={(e) => e.stopPropagation()}>
        <div style={S.payHead}>
          <div style={S.payTotalLbl}>{tr('בחירת מרכיבים', 'اختيار المكوّنات')}</div>
          <div style={S.payTotalBig}>{tr(def.name, def.nameAr)}</div>
          <div style={S.payHeadNote}>{def.price} ₪</div>
        </div>

        <div style={S.comboBody}>
          {includes.length > 0 && (
            <div style={S.comboIncludes}>
              {tr('כולל', 'يشمل') + ': ' + includes.map((c) => itemName(c, lang)).join(' · ')}
            </div>
          )}
          {slots.map((s, i) => (
            <div key={i} style={S.comboSlot}>
              <div style={S.comboSlotLbl}>
                {tr(s.name, s.nameAr)}
                {s.count && <span style={S.comboSlotHint}> ({(s.min || 0) + '–' + s.max})</span>}
              </div>
              {s.count ? (
                <div style={S.comboStepper}>
                  <button
                    className="pos-tap"
                    style={{ ...S.qBtn, opacity: (sel[i] || 0) <= (s.min || 0) ? 0.35 : 1 }}
                    onClick={() => setCount(i, (sel[i] || 0) - 1, s)}
                  >–</button>
                  <span style={S.qNum}>{sel[i] || 0}</span>
                  <button
                    className="pos-tap"
                    style={{ ...S.qBtn, background: SEA, color: '#fff', borderColor: 'transparent' }}
                    onClick={() => setCount(i, (sel[i] || 0) + 1, s)}
                  >+</button>
                </div>
              ) : (
                <Fragment>
                  <div style={S.comboOpts}>
                    {s.options?.map((opt, oi) => (
                      <button
                        key={oi}
                        className="pos-tap"
                        style={{ ...S.comboChip, ...(sel[i] === oi ? S.payChipOn : {}) }}
                        onClick={() => pickOption(i, oi)}
                      >
                        {itemName(opt, lang)}
                      </button>
                    ))}
                  </div>
                  {sel[i] != null && s.options?.[sel[i]]?.other && (
                    <input
                      style={S.comboOther}
                      placeholder={tr('פרטו את הסלט', 'حدد السلطة')}
                      value={otherText[i] || ''}
                      autoFocus
                      onChange={(e) => setOtherText((p) => ({ ...p, [i]: e.target.value }))}
                    />
                  )}
                </Fragment>
              )}
            </div>
          ))}
        </div>

        <div style={S.payBtns}>
          <button className="pos-tap" style={S.receiptClose} onClick={onCancel}>{tr('ביטול', 'إلغاء')}</button>
          <button
            className="pos-tap"
            style={{ ...S.payConfirm, background: valid ? '#3a9e6e' : '#cfc6b6', color: '#fff', cursor: valid ? 'pointer' : 'not-allowed' }}
            disabled={!valid}
            onClick={build}
          >
            {tr('הוספה לשולחן', 'إضافة للطاولة')}
          </button>
        </div>
      </div>
    </div>
  )
}
