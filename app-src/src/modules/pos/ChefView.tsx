// Kitchen display: fired-but-undone dishes grouped by table, oldest order
// first. One big tap = done. Ported from pos.html.
import { useState } from 'react'
import { itemName, usePosTr } from './i18n'
import { fmtTime } from './logic'
import S from './styles'
import type { PosTable } from './types'
import { PosLangToggle } from './widgets'

export default function ChefView({ tables, onMarkDone, onBack }: {
  tables: PosTable[]
  onMarkDone: (tableId: string, itemId: string, ready: boolean) => void
  onBack: () => void
}) {
  const { tr, lang } = usePosTr()
  const [showDone, setShowDone] = useState(false)

  const tickets = tables.map((t) => {
    const cooking = t.items.filter((it) => (it.sent || 0) - (it.done || 0) > 0) // chef's queue
    const ready = t.items.filter((it) => (it.done || 0) > 0) // for "show done"
    const firstFire = t.items.reduce((m, it) =>
      (it.sent || 0) - (it.done || 0) > 0 && it.firedAt ? Math.min(m, Date.parse(it.firedAt) || Infinity) : m, Infinity)
    return { t, cooking, ready, firstFire }
  }).filter((x) => (showDone ? x.ready.length : x.cooking.length) > 0)
    .sort((a, b) => a.firstFire - b.firstFire)

  const pendingCount = tables.reduce((s, t) =>
    s + t.items.reduce((n, it) => n + Math.max(0, (it.sent || 0) - (it.done || 0)), 0), 0)

  return (
    <div style={S.app}>
      <div style={S.chefHead}>
        <button className="pos-tap" style={S.chefBack} onClick={onBack}>{'→ ' + tr('יציאה', 'خروج')}</button>
        <span style={S.chefTitle}>{tr('מטבח', 'المطبخ') + (pendingCount ? ' · ' + pendingCount : '')}</span>
        <PosLangToggle />
      </div>
      <div style={S.chefToolbar}>
        <button className="pos-tap" style={{ ...S.chefToggle, ...(showDone ? S.chefToggleOn : {}) }} onClick={() => setShowDone((v) => !v)}>
          {showDone ? tr('הסתר שהושלמו', 'إخفاء المنجزة') : tr('הצג שהושלמו', 'عرض المنجزة')}
        </button>
      </div>
      <div style={S.scroll}>
        {tickets.length === 0 ? (
          <div style={S.chefEmpty}>{tr('אין הזמנות פתוחות במטבח', 'لا طلبات مفتوحة في المطبخ')}</div>
        ) : (
          tickets.map(({ t, cooking, ready, firstFire }) => {
            const list = showDone ? ready : cooking
            return (
              <div key={t.id} style={S.chefCard}>
                <div style={S.chefCardHead}>
                  <span style={S.chefTableNum}>{t.num}</span>
                  <div style={S.chefCardInfo}>
                    <div style={S.chefTableName}>{(t.name ? t.name + ' · ' : '') + tr('שולחן', 'طاولة') + ' ' + t.num}</div>
                    {isFinite(firstFire) && <div style={S.chefTableSub}>{tr('נשלח', 'أُرسل') + ' ' + fmtTime(firstFire)}</div>}
                  </div>
                  {cooking.length > 0 && <span style={S.chefCount}>{cooking.length}</span>}
                </div>
                {list.map((it) => {
                  const showN = showDone ? it.done || 0 : (it.sent || 0) - (it.done || 0)
                  return (
                    <div key={it.id} style={{ ...S.chefDish, ...(showDone ? S.chefDishDone : {}) }}>
                      <div style={S.chefDishMain}>
                        <span style={S.chefDishQty}>×{showN}</span>
                        <div style={S.chefDishText}>
                          <span style={S.chefDishName}>{itemName(it, lang)}</span>
                          {it.combo && it.components && it.components.length > 0 && (
                            <div style={S.chefDishParts}>
                              {it.components.map((c) => itemName(c, lang) + (c.qty ? ' ×' + c.qty : '')).join(' · ')}
                            </div>
                          )}
                        </div>
                      </div>
                      {showDone ? (
                        <button className="pos-tap" style={S.chefUndo} onClick={() => onMarkDone(t.id, it.id, false)}>{tr('בטל', 'تراجع')}</button>
                      ) : (
                        <button className="pos-tap" style={S.chefDone} onClick={() => onMarkDone(t.id, it.id, true)}>{tr('מוכן', 'تم') + ' ✓'}</button>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
