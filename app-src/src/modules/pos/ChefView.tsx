// Kitchen display: fired-but-undone dishes grouped by table, oldest order
// first. Each tap marks one unit done. Ported from pos.html.
import { useState } from 'react'
import { componentsLine, itemName, usePosTr } from './i18n'
import { fmtTime, kitchenCounts, lineCooking, lineOut } from './logic'
import { getFilterableDishes } from './menuData'
import S, { SEA } from './styles'
import type { PosLine, PosTable } from './types'
import { PosLangToggle } from './widgets'

// Device-local, named dish filters. A preset is a set of dishes the kitchen
// screen shows; the chef switches between them (empty / no active preset = all).
interface Preset { id: string; name: string; dishes: string[] }
const PRESETS_KEY = 'levyam_pos_kitchen_presets_v1'
function loadState(): { presets: Preset[]; activeId: string | null } {
  try {
    const d = JSON.parse(localStorage.getItem(PRESETS_KEY) ?? 'null')
    if (d && Array.isArray(d.presets)) return { presets: d.presets, activeId: d.activeId ?? null }
  } catch { /* corrupt → no presets */ }
  return { presets: [], activeId: null }
}

export default function ChefView({ tables, onMarkDone, onBack }: {
  tables: PosTable[]
  onMarkDone: (tableId: string, itemId: string, ready: boolean) => void
  onBack: () => void
}) {
  const { tr, lang } = usePosTr()
  const [showDone, setShowDone] = useState(false)
  const [saved] = useState(loadState) // read localStorage once on mount
  const [presets, setPresets] = useState<Preset[]>(saved.presets)
  const [activeId, setActiveId] = useState<string | null>(saved.activeId)
  const [manage, setManage] = useState(false)          // manage sheet open
  const [editing, setEditing] = useState<Preset | null>(null) // preset draft being created/edited

  const persist = (nextPresets: Preset[], nextActive: string | null) => {
    setPresets(nextPresets)
    setActiveId(nextActive)
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify({ presets: nextPresets, activeId: nextActive })) } catch { /* quota — in-memory only */ }
  }
  const setActive = (id: string | null) => persist(presets, id)
  const savePreset = (draft: Preset) => {
    const next = presets.some((p) => p.id === draft.id)
      ? presets.map((p) => (p.id === draft.id ? draft : p))
      : [...presets, draft]
    persist(next, draft.id) // activate the just-saved preset
    setEditing(null)
  }
  const deletePreset = (id: string) => persist(presets.filter((p) => p.id !== id), activeId === id ? null : activeId)

  const active = presets.find((p) => p.id === activeId) || null
  const activeSet = new Set(active?.dishes || [])
  // A line matches the active preset if its own dish is selected, or any of its
  // component dishes is (so "fish" also surfaces the fish inside a meal). No active
  // preset — or an empty one — shows everything.
  const matches = (it: PosLine) => activeSet.size === 0
    || activeSet.has(it.name)
    || (it.components || []).some((c) => activeSet.has(c.name))

  const tickets = tables.map((t) => {
    const cooking = t.items.filter((it) => lineCooking(it) > 0 && matches(it)) // chef's queue
    const ready = t.items.filter((it) => (it.done || 0) > 0 && matches(it)) // for "show done"
    const firstFire = t.items.reduce((m, it) =>
      lineCooking(it) > 0 && it.firedAt ? Math.min(m, Date.parse(it.firedAt) || Infinity) : m, Infinity)
    return { t, cooking, ready, firstFire }
  }).filter((x) => (showDone ? x.ready.length : x.cooking.length) > 0)
    .sort((a, b) => a.firstFire - b.firstFire)

  const pendingCount = tables.reduce((s, t) => s + kitchenCounts(t.items).cooking, 0)
  const dishes = editing ? getFilterableDishes() : [] // only needed by the editor overlay

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

      {/* Saved filters — persist on this device. Tap a chip to switch; + adds, ⚙ manages. */}
      <div style={S.chefPresetRow}>
        <button className="pos-tap" style={{ ...S.chefPresetChip, ...(!activeId ? S.chefPresetChipOn : {}) }} onClick={() => setActive(null)}>
          {tr('הכל', 'الكل')}
        </button>
        {presets.map((p) => (
          <button key={p.id} className="pos-tap" style={{ ...S.chefPresetChip, ...(activeId === p.id ? S.chefPresetChipOn : {}) }} onClick={() => setActive(p.id)}>
            {p.name + ' · ' + p.dishes.length}
          </button>
        ))}
        <button className="pos-tap" style={S.chefPresetAdd} title={tr('סינון חדש', 'مرشّح جديد')}
          onClick={() => setEditing({ id: 'p-' + Date.now(), name: '', dishes: [] })}>+</button>
        {presets.length > 0 && (
          <button className="pos-tap" style={S.chefPresetAdd} title={tr('ניהול מסננים', 'إدارة المرشّحات')} onClick={() => setManage(true)}>⚙</button>
        )}
      </div>

      {/* Manage sheet: activate / edit / delete presets, or create a new one */}
      {manage && (
        <div style={S.overlay} onClick={() => setManage(false)}>
          <div style={S.chefFilterPanel} onClick={(e) => e.stopPropagation()}>
            <div style={S.chefFilterHead}>
              <span style={S.chefFilterTitle}>{tr('מסנני מטבח', 'مرشّحات المطبخ')}</span>
            </div>
            <div style={{ overflowY: 'auto' }}>
              <button className="pos-tap" style={{ ...S.chefPresetItemName, ...(!activeId ? { color: SEA } : {}) }}
                onClick={() => { setActive(null); setManage(false) }}>
                {tr('הכל (ללא סינון)', 'الكل (بدون تصفية)') + (!activeId ? ' ✓' : '')}
              </button>
              {presets.map((p) => (
                <div key={p.id} style={S.chefPresetItem}>
                  <button className="pos-tap" style={{ ...S.chefPresetItemName, ...(activeId === p.id ? { color: SEA } : {}) }}
                    onClick={() => { setActive(p.id); setManage(false) }}>
                    {p.name + ' · ' + p.dishes.length + (activeId === p.id ? ' ✓' : '')}
                  </button>
                  <button className="pos-tap" style={S.chefPresetIcon} onClick={() => { setEditing(p); setManage(false) }}>✎</button>
                  <button className="pos-tap" style={S.chefPresetIcon} onClick={() => deletePreset(p.id)}>🗑</button>
                </div>
              ))}
              {presets.length === 0 && <div style={S.chefPresetEmpty}>{tr('אין מסננים שמורים', 'لا مرشّحات محفوظة')}</div>}
            </div>
            <button className="pos-tap" style={S.chefFilterNew}
              onClick={() => { setEditing({ id: 'p-' + Date.now(), name: '', dishes: [] }); setManage(false) }}>
              {'+ ' + tr('סינון חדש', 'مرشّح جديد')}
            </button>
            <button className="pos-tap" style={S.chefFilterDone} onClick={() => setManage(false)}>{tr('סגור', 'إغلاق')}</button>
          </div>
        </div>
      )}

      {/* Editor: name the preset + pick its dishes */}
      {editing && (
        <div style={S.overlay} onClick={() => setEditing(null)}>
          <div style={S.chefFilterPanel} onClick={(e) => e.stopPropagation()}>
            <div style={S.chefFilterHead}>
              <span style={S.chefFilterTitle}>{tr('שם ומנות למסנן', 'اسم المرشّح وأطباقه')}</span>
            </div>
            <input
              style={S.chefFilterInput}
              placeholder={tr('שם המסנן (לדוגמה: גריל)', 'اسم المرشّح (مثال: شواء)')}
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              autoFocus
            />
            <div style={S.chefFilterList}>
              {dishes.map((d) => {
                const on = editing.dishes.includes(d.name)
                return (
                  <button key={d.name} className="pos-tap" style={{ ...S.chefFilterChip, ...(on ? S.chefFilterChipOn : {}) }}
                    onClick={() => setEditing({ ...editing, dishes: on ? editing.dishes.filter((x) => x !== d.name) : [...editing.dishes, d.name] })}>
                    {(lang === 'ar' ? d.nameAr : d.name) + (on ? ' ✓' : '')}
                  </button>
                )
              })}
            </div>
            <div style={S.chefFilterBtns}>
              <button className="pos-tap" style={S.chefFilterCancel} onClick={() => setEditing(null)}>{tr('ביטול', 'إلغاء')}</button>
              <button className="pos-tap"
                style={{ ...S.chefFilterSave, background: editing.name.trim() && editing.dishes.length ? SEA : '#cfc6b6', cursor: editing.name.trim() && editing.dishes.length ? 'pointer' : 'not-allowed' }}
                disabled={!editing.name.trim() || !editing.dishes.length}
                onClick={() => savePreset({ ...editing, name: editing.name.trim() })}>
                {tr('שמירה', 'حفظ')}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  {cooking.length > 0 && <span style={S.chefCount}>{cooking.reduce((s, it) => s + lineCooking(it), 0)}</span>}
                </div>
                {list.map((it) => {
                  const showN = showDone ? lineOut(it) : lineCooking(it)
                  return (
                    <div key={it.id} style={{ ...S.chefDish, ...(showDone ? S.chefDishDone : {}) }}>
                      <div style={S.chefDishMain}>
                        <span style={S.chefDishQty}>×{showN}</span>
                        <div style={S.chefDishText}>
                          <span style={S.chefDishName}>{itemName(it, lang)}</span>
                          {it.components && it.components.length > 0 && (
                            <div style={S.chefDishParts}>{componentsLine(it.components, lang)}</div>
                          )}
                          {it.note && <div style={S.chefDishNote}>{'📝 ' + it.note}</div>}
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
