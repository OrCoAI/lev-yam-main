// Owner/manager menu editor (pos.menu). The menu is DB data (schema/51+52); this
// screen is CRUD over it — categories, items (incl. meals), option groups and
// their options. Writes go through RLS (pos.menu); every save refreshes the live
// floor menu (refreshMenu) so changes show immediately. Reached from the POS home.
import { useEffect, useState } from 'react'
import {
  type CategoryInput, deleteCategory, deleteItem, deleteOption, deleteOptionGroup,
  fetchMenuAdmin, type ItemInput, type MenuCategoryRow, type MenuItemRow,
  type MenuOptionGroupRow, type MenuOptionRow, type OptionGroupInput, type OptionInput,
  upsertCategory, upsertItem, upsertOption, upsertOptionGroup,
} from './api'
import { usePosTr } from './i18n'
import { refreshMenu } from './menuData'
import S, { SEA } from './styles'
import { PosLangToggle } from './widgets'

type Include = { name_he: string; name_ar: string }
interface ItemDraft {
  id: string; category_id: string; name_he: string; name_ar: string
  price: string; sort: number; is_meal: boolean; active: boolean; includes: Include[]
}
type AdminData = { categories: MenuCategoryRow[]; items: MenuItemRow[]; groups: MenuOptionGroupRow[]; options: MenuOptionRow[] }

const KINDS: { k: 'choice' | 'count' | 'add'; he: string; ar: string }[] = [
  { k: 'choice', he: 'בחירה אחת', ar: 'اختيار واحد' },
  { k: 'count', he: 'כמות', ar: 'كمية' },
  { k: 'add', he: 'תוספת', ar: 'إضافة' },
]

const uid = (p: string) => p + '_' + Date.now().toString(36)
const toIncludes = (raw: unknown): Include[] => {
  const c = raw as { includes?: Include[] } | null
  return c && Array.isArray(c.includes) ? c.includes : []
}

export default function MenuAdmin({ onBack }: { onBack: () => void }) {
  const { tr, lang } = usePosTr()
  const L = (he: string, ar: string) => (lang === 'ar' ? ar : he)
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editItem, setEditItem] = useState<ItemDraft | null>(null)
  const [editCat, setEditCat] = useState<CategoryInput | null>(null)
  const [editGroup, setEditGroup] = useState<OptionGroupInput | null>(null)
  const [editOpt, setEditOpt] = useState<OptionInput | null>(null)

  const reload = async () => setData(await fetchMenuAdmin())
  useEffect(() => { fetchMenuAdmin().then(setData).catch((e) => alert(String(e))).finally(() => setLoading(false)) }, [])

  // run a write, surface any RLS/validation error, then refresh both this editor and the
  // live floor menu (in parallel — they read overlapping tables).
  const run = async (op: PromiseLike<{ error: { message: string } | null }>, after?: () => void) => {
    const { error } = await op
    if (error) { alert(tr('שמירה נכשלה', 'فشل الحفظ') + '\n' + error.message); return }
    await Promise.all([reload(), refreshMenu()]); after?.()
  }

  const itemExists = (id: string) => !!data?.items.some((i) => i.id === id)

  const saveItem = (d: ItemDraft) => {
    const price = parseFloat(d.price)
    if (!d.name_he.trim() || !d.name_ar.trim() || isNaN(price) || price < 0) { alert(tr('שם (עברית + ערבית) ומחיר תקין נדרשים', 'الاسم (عبري + عربي) وسعر صحيح مطلوبان')); return }
    const row: ItemInput = {
      id: d.id, category_id: d.category_id, name_he: d.name_he.trim(), name_ar: d.name_ar.trim(),
      price, sort: d.sort, is_meal: d.is_meal, active: d.active,
      composition: d.is_meal ? { includes: d.includes.filter((x) => x.name_he.trim()) } : null,
    }
    void run(upsertItem(row), () => setEditItem(null))
  }

  if (loading) return <div style={S.app}><div style={S.chefEmpty}>{tr('טוען תפריט…', 'جارٍ التحميل…')}</div></div>
  if (!data) return <div style={S.app}><div style={S.chefEmpty}>{tr('טעינת התפריט נכשלה', 'فشل تحميل القائمة')}</div></div>

  const groupsOf = (itemId: string) => data.groups.filter((g) => g.item_id === itemId)
  const optionsOf = (groupId: string) => data.options.filter((o) => o.group_id === groupId)
  const editingGroups = editItem ? groupsOf(editItem.id) : []

  return (
    <div style={S.app}>
      <div style={S.chefHead}>
        <button className="pos-tap" style={S.chefBack} onClick={onBack}>{'→ ' + tr('חזרה', 'رجوع')}</button>
        <span style={S.chefTitle}>{tr('עריכת תפריט', 'تعديل القائمة')}</span>
        <PosLangToggle />
      </div>

      <div style={S.scroll}>
        {data.categories.map((c) => (
          <section key={c.id} style={S.section}>
            <div style={S.maCatHead}>
              <h2 style={{ ...S.catTitle, opacity: c.active ? 1 : 0.5 }}>
                {L(c.name_he, c.name_ar)}{c.pos_only ? ' · ' + tr('קופה בלבד', 'الكاشير فقط') : ''}{!c.active ? ' · ' + tr('מוסתר', 'مخفي') : ''}
              </h2>
              <button className="pos-tap" style={S.maIcon} onClick={() => setEditCat({ id: c.id, name_he: c.name_he, name_ar: c.name_ar, sort: c.sort, pos_only: c.pos_only, active: c.active })}>✎</button>
            </div>
            {data.items.filter((i) => i.category_id === c.id).map((i) => {
              const gc = groupsOf(i.id).length
              return (
                <button key={i.id} className="pos-tap" style={S.maRow} onClick={() => setEditItem({
                  id: i.id, category_id: i.category_id, name_he: i.name_he, name_ar: i.name_ar,
                  price: String(i.price), sort: i.sort, is_meal: i.is_meal, active: i.active, includes: toIncludes(i.composition),
                })}>
                  <span style={{ ...S.maRowName, opacity: i.active ? 1 : 0.45 }}>
                    {L(i.name_he, i.name_ar)}
                    {i.is_meal ? <span style={S.maTag}>{tr('ארוחה', 'وجبة')}</span> : null}
                    {gc > 0 ? <span style={S.maTag}>{tr('תוספות', 'إضافات') + ' ' + gc}</span> : null}
                    {!i.active ? <span style={S.maTagOff}>{tr('מוסתר', 'مخفي')}</span> : null}
                  </span>
                  <span style={S.maRowPrice}>{Number(i.price)} ₪</span>
                </button>
              )
            })}
            <button className="pos-tap" style={S.maAdd} onClick={() => setEditItem({
              id: uid('item'), category_id: c.id, name_he: '', name_ar: '', price: '', sort: 100, is_meal: false, active: true, includes: [],
            })}>{'+ ' + tr('מנה חדשה', 'صنف جديد')}</button>
          </section>
        ))}

        <button className="pos-tap" style={S.maAddCat} onClick={() => setEditCat({ id: uid('cat'), name_he: '', name_ar: '', sort: 100, pos_only: false, active: true })}>
          {'+ ' + tr('קטגוריה חדשה', 'فئة جديدة')}
        </button>
        <div style={{ height: 100 }} />
      </div>

      {/* ── Category editor ── */}
      {editCat && (
        <div style={S.overlay} onClick={() => setEditCat(null)}>
          <div style={S.chefFilterPanel} onClick={(e) => e.stopPropagation()}>
            <div style={S.chefFilterHead}><span style={S.chefFilterTitle}>{tr('קטגוריה', 'فئة')}</span></div>
            <div style={S.maForm}>
              <input style={S.addInput} placeholder={tr('שם (עברית)', 'الاسم (عبري)')} value={editCat.name_he} onChange={(e) => setEditCat({ ...editCat, name_he: e.target.value })} autoFocus />
              <input style={S.addInput} placeholder={tr('שם (ערבית)', 'الاسم (عربي)')} value={editCat.name_ar} onChange={(e) => setEditCat({ ...editCat, name_ar: e.target.value })} />
              <div style={S.maToggleRow}>
                <button className="pos-tap" style={{ ...S.maToggle, ...(editCat.active ? S.maToggleOn : {}) }} onClick={() => setEditCat({ ...editCat, active: !editCat.active })}>{tr('פעילה', 'مفعّلة') + (editCat.active ? ' ✓' : '')}</button>
                <button className="pos-tap" style={{ ...S.maToggle, ...(editCat.pos_only ? S.maToggleOn : {}) }} onClick={() => setEditCat({ ...editCat, pos_only: !editCat.pos_only })}>{tr('קופה בלבד', 'الكاشير فقط') + (editCat.pos_only ? ' ✓' : '')}</button>
              </div>
            </div>
            <div style={S.chefFilterBtns}>
              {data.categories.some((c) => c.id === editCat.id) && (
                data.items.some((i) => i.category_id === editCat.id)
                  ? <span style={{ ...S.maHint, flex: 1, alignSelf: 'center' }}>{tr('יש מנות בקטגוריה — מחקו/העבירו אותן לפני מחיקתה', 'الفئة تحتوي أصنافاً — احذفها/انقلها أولاً')}</span>
                  : <button className="pos-tap" style={S.maDelBtn} onClick={() => { if (window.confirm(tr('למחוק את הקטגוריה?', 'حذف الفئة؟'))) void run(deleteCategory(editCat.id), () => setEditCat(null)) }}>{tr('מחק', 'حذف')}</button>
              )}
              <button className="pos-tap" style={S.chefFilterCancel} onClick={() => setEditCat(null)}>{tr('ביטול', 'إلغاء')}</button>
              <button className="pos-tap" style={{ ...S.chefFilterSave, background: editCat.name_he.trim() && editCat.name_ar.trim() ? SEA : '#cfc6b6' }}
                disabled={!editCat.name_he.trim() || !editCat.name_ar.trim()}
                onClick={() => void run(upsertCategory({ ...editCat, name_he: editCat.name_he.trim(), name_ar: editCat.name_ar.trim() }), () => setEditCat(null))}>{tr('שמירה', 'حفظ')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Item editor ── */}
      {editItem && (
        <div style={S.overlay} onClick={() => setEditItem(null)}>
          <div style={S.chefFilterPanel} onClick={(e) => e.stopPropagation()}>
            <div style={S.chefFilterHead}><span style={S.chefFilterTitle}>{tr('מנה', 'صنف')}</span></div>
            <div style={S.maForm}>
              <input style={S.addInput} placeholder={tr('שם (עברית)', 'الاسم (عبري)')} value={editItem.name_he} onChange={(e) => setEditItem({ ...editItem, name_he: e.target.value })} autoFocus />
              <input style={S.addInput} placeholder={tr('שם (ערבית)', 'الاسم (عربي)')} value={editItem.name_ar} onChange={(e) => setEditItem({ ...editItem, name_ar: e.target.value })} />
              <div style={S.maRow2}>
                <input style={{ ...S.addInput, flex: 1 }} type="number" inputMode="decimal" placeholder={tr('מחיר ₪', 'السعر ₪')} value={editItem.price} onChange={(e) => setEditItem({ ...editItem, price: e.target.value })} />
                <select style={S.maSelect} value={editItem.category_id} onChange={(e) => setEditItem({ ...editItem, category_id: e.target.value })}>
                  {data.categories.map((c) => <option key={c.id} value={c.id}>{L(c.name_he, c.name_ar)}</option>)}
                </select>
              </div>
              <div style={S.maToggleRow}>
                <button className="pos-tap" style={{ ...S.maToggle, ...(editItem.active ? S.maToggleOn : {}) }} onClick={() => setEditItem({ ...editItem, active: !editItem.active })}>{tr('פעילה', 'مفعّلة') + (editItem.active ? ' ✓' : '')}</button>
                <button className="pos-tap" style={{ ...S.maToggle, ...(editItem.is_meal ? S.maToggleOn : {}) }} onClick={() => setEditItem({ ...editItem, is_meal: !editItem.is_meal })}>{tr('ארוחה', 'وجبة') + (editItem.is_meal ? ' ✓' : '')}</button>
              </div>

              {/* meal fixed dishes */}
              {editItem.is_meal && (
                <div style={S.maSub}>
                  <div style={S.maSubTitle}>{tr('כולל (מנות קבועות)', 'يشمل (أطباق ثابتة)')}</div>
                  {editItem.includes.map((inc, ix) => (
                    <div key={ix} style={S.maRow2}>
                      <input style={{ ...S.addInput, flex: 1 }} placeholder={tr('עברית', 'عبري')} value={inc.name_he} onChange={(e) => setEditItem({ ...editItem, includes: editItem.includes.map((x, j) => j === ix ? { ...x, name_he: e.target.value } : x) })} />
                      <input style={{ ...S.addInput, flex: 1 }} placeholder={tr('ערבית', 'عربي')} value={inc.name_ar} onChange={(e) => setEditItem({ ...editItem, includes: editItem.includes.map((x, j) => j === ix ? { ...x, name_ar: e.target.value } : x) })} />
                      <button className="pos-tap" style={S.delBtn} onClick={() => setEditItem({ ...editItem, includes: editItem.includes.filter((_, j) => j !== ix) })}>✕</button>
                    </div>
                  ))}
                  <button className="pos-tap" style={S.maAdd} onClick={() => setEditItem({ ...editItem, includes: [...editItem.includes, { name_he: '', name_ar: '' }] })}>{'+ ' + tr('מנה קבועה', 'طبق ثابت')}</button>
                </div>
              )}

              {/* option groups — only after the item exists (they reference its id) */}
              <div style={S.maSub}>
                <div style={S.maSubTitle}>{tr('תוספות ובחירות', 'الإضافات والخيارات')}</div>
                {!itemExists(editItem.id) ? (
                  <div style={S.maHint}>{tr('שמרו את המנה כדי להוסיף תוספות', 'احفظ الصنف لإضافة الإضافات')}</div>
                ) : (
                  <>
                    {editingGroups.map((g) => (
                      <div key={g.id} style={S.maGroup}>
                        <button className="pos-tap" style={S.maGroupHead} onClick={() => setEditGroup({ id: g.id, item_id: g.item_id, name_he: g.name_he, name_ar: g.name_ar, kind: g.kind, min_sel: g.min_sel, max_sel: g.max_sel, included: g.included, sort: g.sort })}>
                          <span style={S.maRowName}>{L(g.name_he, g.name_ar)}<span style={S.maTag}>{L(KINDS.find((x) => x.k === g.kind)?.he || g.kind, KINDS.find((x) => x.k === g.kind)?.ar || g.kind)}</span></span>
                          <span style={S.maRowPrice}>✎</span>
                        </button>
                        <div style={S.maOptWrap}>
                          {optionsOf(g.id).map((o) => (
                            <button key={o.id} className="pos-tap" style={S.maOptChip} onClick={() => setEditOpt({ id: o.id, group_id: o.group_id, name_he: o.name_he, name_ar: o.name_ar, price_delta: Number(o.price_delta), sort: o.sort })}>
                              {L(o.name_he, o.name_ar)}{Number(o.price_delta) > 0 ? ' +' + Number(o.price_delta) : ''}
                            </button>
                          ))}
                          <button className="pos-tap" style={S.maOptAdd} onClick={() => setEditOpt({ id: uid('o'), group_id: g.id, name_he: '', name_ar: '', price_delta: 0, sort: (optionsOf(g.id).length + 1) * 10 })}>{'+'}</button>
                        </div>
                      </div>
                    ))}
                    <button className="pos-tap" style={S.maAdd} onClick={() => setEditGroup({ id: uid('g'), item_id: editItem.id, name_he: '', name_ar: '', kind: 'add', min_sel: 0, max_sel: 1, included: 0, sort: (editingGroups.length + 1) * 10 })}>{'+ ' + tr('קבוצת תוספות', 'مجموعة إضافات')}</button>
                  </>
                )}
              </div>
            </div>

            <div style={S.chefFilterBtns}>
              {itemExists(editItem.id) && (
                <button className="pos-tap" style={S.maDelBtn} onClick={() => { if (window.confirm(tr('למחוק את המנה מהתפריט? מכירות ודוחות של ימים קודמים לא יושפעו. כדי להסתיר זמנית — כבו "פעילה".', 'حذف الصنف من القائمة؟ مبيعات وتقارير الأيام السابقة لن تتأثّر. للإخفاء مؤقتاً أطفئ "مفعّلة".'))) void run(deleteItem(editItem.id), () => setEditItem(null)) }}>{tr('מחק', 'حذف')}</button>
              )}
              <button className="pos-tap" style={S.chefFilterCancel} onClick={() => setEditItem(null)}>{tr('סגור', 'إغلاق')}</button>
              <button className="pos-tap" style={{ ...S.chefFilterSave, background: SEA }} onClick={() => saveItem(editItem)}>{tr('שמירה', 'حفظ')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Option-group editor ── */}
      {editGroup && (
        <div style={S.overlay} onClick={() => setEditGroup(null)}>
          <div style={S.chefFilterPanel} onClick={(e) => e.stopPropagation()}>
            <div style={S.chefFilterHead}><span style={S.chefFilterTitle}>{tr('קבוצת תוספות', 'مجموعة إضافات')}</span></div>
            <div style={S.maForm}>
              <input style={S.addInput} placeholder={tr('שם (עברית)', 'الاسم (عبري)')} value={editGroup.name_he} onChange={(e) => setEditGroup({ ...editGroup, name_he: e.target.value })} autoFocus />
              <input style={S.addInput} placeholder={tr('שם (ערבית)', 'الاسم (عربي)')} value={editGroup.name_ar} onChange={(e) => setEditGroup({ ...editGroup, name_ar: e.target.value })} />
              <div style={S.maToggleRow}>
                {KINDS.map((k) => (
                  <button key={k.k} className="pos-tap" style={{ ...S.maToggle, ...(editGroup.kind === k.k ? S.maToggleOn : {}) }} onClick={() => setEditGroup({ ...editGroup, kind: k.k })}>{L(k.he, k.ar)}</button>
                ))}
              </div>
              <div style={S.maRow2}>
                <label style={S.maNumField}>{tr('מינ׳', 'أدنى')}<input style={S.maNum} type="number" inputMode="numeric" value={editGroup.min_sel} onChange={(e) => setEditGroup({ ...editGroup, min_sel: parseInt(e.target.value, 10) || 0 })} /></label>
                <label style={S.maNumField}>{tr('מקס׳', 'أقصى')}<input style={S.maNum} type="number" inputMode="numeric" value={editGroup.max_sel} onChange={(e) => setEditGroup({ ...editGroup, max_sel: parseInt(e.target.value, 10) || 0 })} /></label>
                <label style={S.maNumField}>{tr('חינם', 'مجاناً')}<input style={S.maNum} type="number" inputMode="numeric" value={editGroup.included} onChange={(e) => setEditGroup({ ...editGroup, included: parseInt(e.target.value, 10) || 0 })} /></label>
              </div>
              <div style={S.maHint}>{tr('בחירה: מינ׳ 1 = חובה · כמות: חינם = יחידות חינם לפני חיוב', 'اختيار: أدنى 1 = إلزامي · كمية: مجاناً = وحدات قبل الاحتساب')}</div>
            </div>
            <div style={S.chefFilterBtns}>
              {data.groups.some((g) => g.id === editGroup.id) && (
                <button className="pos-tap" style={S.maDelBtn} onClick={() => { if (window.confirm(tr('למחוק את הקבוצה?', 'حذف المجموعة؟'))) void run(deleteOptionGroup(editGroup.id), () => setEditGroup(null)) }}>{tr('מחק', 'حذف')}</button>
              )}
              <button className="pos-tap" style={S.chefFilterCancel} onClick={() => setEditGroup(null)}>{tr('ביטול', 'إلغاء')}</button>
              <button className="pos-tap" style={{ ...S.chefFilterSave, background: editGroup.name_he.trim() && editGroup.name_ar.trim() && editGroup.max_sel >= editGroup.min_sel ? SEA : '#cfc6b6' }}
                disabled={!editGroup.name_he.trim() || !editGroup.name_ar.trim() || editGroup.max_sel < editGroup.min_sel}
                onClick={() => void run(upsertOptionGroup({ ...editGroup, name_he: editGroup.name_he.trim(), name_ar: editGroup.name_ar.trim() }), () => setEditGroup(null))}>{tr('שמירה', 'حفظ')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Option editor ── */}
      {editOpt && (
        <div style={S.overlay} onClick={() => setEditOpt(null)}>
          <div style={S.chefFilterPanel} onClick={(e) => e.stopPropagation()}>
            <div style={S.chefFilterHead}><span style={S.chefFilterTitle}>{tr('תוספת', 'إضافة')}</span></div>
            <div style={S.maForm}>
              <input style={S.addInput} placeholder={tr('שם (עברית)', 'الاسم (عبري)')} value={editOpt.name_he} onChange={(e) => setEditOpt({ ...editOpt, name_he: e.target.value })} autoFocus />
              <input style={S.addInput} placeholder={tr('שם (ערבית)', 'الاسم (عربي)')} value={editOpt.name_ar} onChange={(e) => setEditOpt({ ...editOpt, name_ar: e.target.value })} />
              <input style={S.addInput} type="number" inputMode="decimal" placeholder={tr('תוספת מחיר ₪ (0 = חינם)', 'زيادة السعر ₪ (0 = مجاناً)')} value={editOpt.price_delta} onChange={(e) => setEditOpt({ ...editOpt, price_delta: parseFloat(e.target.value) || 0 })} />
            </div>
            <div style={S.chefFilterBtns}>
              {data.options.some((o) => o.id === editOpt.id) && (
                <button className="pos-tap" style={S.maDelBtn} onClick={() => { if (window.confirm(tr('למחוק את התוספת?', 'حذف الإضافة؟'))) void run(deleteOption(editOpt.id), () => setEditOpt(null)) }}>{tr('מחק', 'حذف')}</button>
              )}
              <button className="pos-tap" style={S.chefFilterCancel} onClick={() => setEditOpt(null)}>{tr('ביטול', 'إلغاء')}</button>
              <button className="pos-tap" style={{ ...S.chefFilterSave, background: editOpt.name_he.trim() && editOpt.name_ar.trim() && editOpt.price_delta >= 0 ? SEA : '#cfc6b6' }}
                disabled={!editOpt.name_he.trim() || !editOpt.name_ar.trim() || editOpt.price_delta < 0}
                onClick={() => void run(upsertOption({ ...editOpt, name_he: editOpt.name_he.trim(), name_ar: editOpt.name_ar.trim() }), () => setEditOpt(null))}>{tr('שמירה', 'حفظ')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
