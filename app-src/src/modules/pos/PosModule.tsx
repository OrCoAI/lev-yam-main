// POS root: the floor (open tables), table view, kitchen mode and the day
// report. Full-screen (outside the shell Layout) like the standalone tool —
// staff work it on phones mid-service. pos.html's device PIN + RoleModal are
// replaced by the platform login + RBAC (useCan on pos.* keys).
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PERM, useCan } from '../../lib/permissions'
import ChefView from './ChefView'
import { usePosTr } from './i18n'
import MenuAdmin from './MenuAdmin'
import { fmtDate, fmtTime, kitchenCounts, REPORT_DATE_RE, tableTotals, todayKey } from './logic'
import { useMenu } from './menuData'
import ReportView from './ReportView'
import S, { INK, SEA, SUN } from './styles'
import TableView from './TableView'
import { usePosData } from './usePosData'
import { PosLangToggle, TotalCell } from './widgets'

export default function PosModule() {
  const { tr } = usePosTr()
  const canOrder = useCan(PERM.posOrder)
  const canKitchen = useCan(PERM.posKitchen)
  const canAnalytics = useCan(PERM.posAnalytics)
  const canReports = useCan(PERM.posReports)
  const canManage = useCan(PERM.posManage)
  const canMenu = useCan(PERM.posMenu)
  const canAddFood = useCan(PERM.posCostsFood)
  const canAddLabor = useCan(PERM.posCostsLabor)

  // ?report=YYYY-MM-DD deep link (finance provenance, built via posReportHref):
  // open the day report at that date. Initial state only — the URL is not kept
  // in sync afterwards.
  const [searchParams] = useSearchParams()
  const reportParam = searchParams.get('report')
  const reportDate = reportParam && REPORT_DATE_RE.test(reportParam) ? reportParam : null

  const [activeId, setActiveId] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(reportDate !== null)
  const [chefMode, setChefMode] = useState(false)
  const [menuMode, setMenuMode] = useState(false)
  useMenu() // load the owner-editable menu (DB) into the runtime store; re-renders when it refreshes

  const pos = usePosData(activeId, (message) =>
    alert(tr('שמירת החשבון נכשלה — בדקו חיבור ונסו שוב', 'فشل حفظ الحساب — تحقق من الاتصال وحاول مجدداً') + '\n' + message))
  const data = pos.data

  const openNew = () => setActiveId(pos.openNew())
  const payAndClose = (id: string, payment: Parameters<typeof pos.payAndClose>[1]) => { pos.payAndClose(id, payment); setActiveId(null) }
  const cancelTable = (id: string) => { pos.cancelTable(id); setActiveId(null) }
  const reopen = (id: string) => { pos.reopen(id); setShowReport(false) }

  if (chefMode && canKitchen) {
    return <ChefView tables={data.tables} onMarkDone={pos.markDone} onBack={() => setChefMode(false)} />
  }

  if (menuMode && canMenu) {
    return <MenuAdmin onBack={() => setMenuMode(false)} />
  }

  const active = data.tables.find((t) => t.id === activeId)
  if (active && canOrder) {
    return (
      <TableView
        table={active}
        payments={pos.payments[active.id] || []}
        canManage={canManage}
        onUpdate={(updater) => pos.updateTable(active.id, updater)}
        onBack={() => setActiveId(null)}
        onPaid={(payment) => payAndClose(active.id, payment)}
        onRecordPayment={(pmts) => void pos.recordPayments(active.id, pmts)}
        onVoidPayment={(pid) => void pos.voidPayment(pid)}
        onEditPayment={(pid, method, amount) => void pos.editPayment(pid, method, amount)}
        onVoidItem={(name, qty, price, fired, reason) => pos.voidItem(active.id, name, qty, price, fired, reason)}
        onCancelTable={() => cancelTable(active.id)}
        onFire={() => pos.fireTable(active.id)}
      />
    )
  }

  const today = todayKey()
  const list = data.closed.filter((c) => new Date(c.paidAt).toDateString() === today)
  const cash = list.reduce((s, c) => s + (c.cash || 0), 0)
  const card = list.reduce((s, c) => s + (c.card || 0), 0)

  return (
    <>
      {!pos.online && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, background: '#c2553f', color: '#fff', textAlign: 'center', padding: '6px 8px', fontSize: 13, fontWeight: 600, zIndex: 9999 }}>
          {tr('אין חיבור — הנתונים יסונכרנו כשהחיבור יחזור', 'لا يوجد اتصال — ستتم المزامنة عند عودته')}
        </div>
      )}
      <div style={S.app}>
        <div style={S.homeHead}>
          <span style={S.homeBrand}>{tr('לב ים', 'قلب البحر')}</span>
          <div style={S.homeHeadSide}>
            <Link to="/" style={{ ...S.homeDate, color: '#fff', textDecoration: 'none' }}>{'← ' + tr('מערכת', 'النظام')}</Link>
            <PosLangToggle />
            <span style={S.homeDate}>{fmtDate()}</span>
          </div>
        </div>

        <div style={S.scroll}>
          {canReports ? (
            <div style={{ ...S.totalsCard, cursor: 'pointer' }} onClick={() => setShowReport(true)}>
              <div style={S.totalsTopRow}>
                <span style={S.totalsTitle}>{tr('סיכום ודוח היום', 'ملخص وتقرير اليوم')}</span>
              </div>
              <div style={S.totalsGrid}>
                <TotalCell label={tr('מזומן', 'نقداً')} val={cash} color="#3a9e6e" />
                <TotalCell label={tr('אשראי', 'بطاقة')} val={card} color={SEA} />
                <TotalCell label={tr('סה״כ', 'المجموع')} val={cash + card} color={INK} />
              </div>
              <div style={S.totalsHint}>{tr('רווח · עלויות · היסטוריה לפי תאריך', 'ربح · تكاليف · سجل حسب التاريخ') + ' ›'}</div>
            </div>
          ) : canAnalytics ? (
            <div style={{ ...S.totalsCard, cursor: 'pointer' }} onClick={() => setShowReport(true)}>
              <div style={S.totalsTopRow}>
                <span style={S.totalsTitle}>{tr('דוח מטבח', 'تقرير المطبخ')}</span>
              </div>
              <div style={S.totalsHint}>{tr('שולחנות · סועדים · פריטים · עלות מזון', 'طاولات · ضيوف · أصناف · تكلفة الطعام') + ' ›'}</div>
            </div>
          ) : null /* waiters have no summary/report on the home screen */}

          <div style={S.sectionLabel}>{tr('שולחנות פתוחים', 'طاولات مفتوحة') + ' · ' + data.tables.length}</div>

          {data.tables.length === 0 ? (
            <div style={S.emptyTables}>
              <div style={{ fontWeight: 800, fontSize: 15, color: INK }}>{tr('אין שולחנות פתוחים', 'لا توجد طاولات مفتوحة')}</div>
              <div style={{ marginTop: 6 }}>{tr('פתחו שולחן חדש כדי להתחיל', 'افتح طاولة جديدة للبدء')}</div>
            </div>
          ) : (
            <div style={S.tablesGrid}>
              {data.tables.map((t) => {
                const tt = tableTotals(t)
                const k = kitchenCounts(t.items)
                const paid = (pos.payments[t.id] || []).reduce((s, p) => s + p.amount, 0)
                return (
                  <button
                    key={t.id}
                    className="pos-tap"
                    style={S.tableCard}
                    onClick={() => { if (canOrder) { pos.serveReady(t.id); setActiveId(t.id) } }}
                  >
                    <div style={S.tableCardHead}>
                      <span style={{ ...S.tableNumBadge, background: SUN }}>{t.num}</span>
                      {/* Name gets the whole head row now (wraps in full) — kitchen state moved
                          down to the meta line so a long name is never truncated. */}
                      <span style={S.tableName}>{t.name || tr('שולחן', 'طاولة') + ' ' + t.num}</span>
                    </div>
                    <div style={S.tableMetaRow}>
                      <span style={S.tableMeta}>{tt.headcount + ' ' + tr('סועדים', 'ضيوف') + ' · ' + tt.itemsCount + ' ' + tr('פריטים', 'أصناف')}</span>
                      {(k.ready > 0 || k.cooking > 0) ? (
                        <span style={S.kitchenHead}>
                          {k.ready > 0 && <span style={S.stReady} title={tr('מוכן', 'جاهز')}>{'🔔 ' + k.ready}</span>}
                          {k.cooking > 0 && <span style={S.stFired} title={tr('במטבח', 'في المطبخ')}>{'🍳 ' + k.cooking}</span>}
                        </span>
                      ) : k.served > 0 && k.unsent === 0 ? (
                        <span style={S.stServed} title={tr('הכל הוגש', 'تم التقديم')}>✓</span>
                      ) : null}
                    </div>
                    {paid > 0 && (
                      <span style={S.tablePartPaid}>{tr('נותר', 'المتبقي') + ' ' + Math.max(0, tt.grand - paid) + ' ₪ · ' + tr('שולם', 'مدفوع') + ' ' + paid}</span>
                    )}
                    <div style={S.tableCardTotal}>
                      <span style={S.tableCardNum}>{tt.grand}</span>
                      <span style={S.tableCardCur}>₪</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Closed today — visible right on the floor (owner 2026-07-29), not only in
              the report. Read-only; a manager can reopen a mistakenly-closed table. */}
          {list.length > 0 && (
            <>
              <div style={{ ...S.sectionLabel, marginTop: 18 }}>{tr('שולחנות שנסגרו היום', 'طاولات أُغلقت اليوم') + ' · ' + list.length}</div>
              <div style={S.closedList}>
                {list.map((c) => (
                  <div key={c.id} style={S.closedRowCard}>
                    <span style={S.closedRowBadge}>{c.num}</span>
                    <div style={S.closedRowInfo}>
                      <span style={S.closedRowName}>{c.name || tr('שולחן', 'طاولة') + ' ' + c.num}</span>
                      <span style={S.closedRowSub}>
                        {fmtTime(c.paidAt)
                          + (c.cash > 0 ? ' · ' + tr('מזומן', 'نقداً') + ' ' + c.cash : '')
                          + (c.card > 0 ? ' · ' + tr('אשראי', 'بطاقة') + ' ' + c.card : '')}
                      </span>
                    </div>
                    <span style={S.closedRowTotal}>{c.total} ₪</span>
                    {canManage && (
                      <button className="pos-tap" style={S.reopenBtn}
                        onClick={() => { if (window.confirm(tr('לפתוח מחדש את השולחן?', 'إعادة فتح الطاولة؟'))) reopen(c.id) }}>
                        {tr('פתח מחדש', 'إعادة فتح')}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{ height: 120 }} />
        </div>

        <div style={S.homeDock}>
          {canMenu && (
            <button className="pos-tap" style={S.menuBtn} onClick={() => setMenuMode(true)}>{tr('תפריט', 'القائمة')}</button>
          )}
          {canKitchen && (
            <button className="pos-tap" style={S.chefEnterBtn} onClick={() => setChefMode(true)}>{tr('מטבח', 'المطبخ')}</button>
          )}
          {canOrder && (
            <button className="pos-tap" style={S.newTableBtn} onClick={openNew}>{'+ ' + tr('שולחן חדש', 'طاولة جديدة')}</button>
          )}
        </div>
      </div>

      {showReport && (canAnalytics || canReports) && (
        <ReportView
          initialDate={reportDate ?? undefined}
          full={canReports}
          canAddFood={canAddFood}
          canAddLabor={canAddLabor}
          canManage={canManage}
          closed={data.closed}
          onReopen={reopen}
          onClear={pos.clearToday}
          onClose={() => setShowReport(false)}
        />
      )}
    </>
  )
}
