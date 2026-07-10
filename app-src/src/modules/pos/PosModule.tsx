// POS root: the floor (open tables), table view, kitchen mode and the day
// report. Full-screen (outside the shell Layout) like the standalone tool —
// staff work it on phones mid-service. pos.html's device PIN + RoleModal are
// replaced by the platform login + RBAC (useCan on pos.* keys).
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { PERM, useCan } from '../../lib/permissions'
import ChefView from './ChefView'
import { usePosTr } from './i18n'
import { fmtDate, tableTotals, todayKey } from './logic'
import ReportView from './ReportView'
import S, { INK, SEA, SUN } from './styles'
import TableView from './TableView'
import { usePosData } from './usePosData'
import { PosLangToggle, TotalCell } from './widgets'

export default function PosModule() {
  const { tr } = usePosTr()
  const { user } = useAuth()
  const canOrder = useCan(PERM.posOrder)
  const canKitchen = useCan(PERM.posKitchen)
  const canAnalytics = useCan(PERM.posAnalytics)
  const canReports = useCan(PERM.posReports)
  const canManage = useCan(PERM.posManage)
  const canAddFood = useCan(PERM.posCostsFood)
  const canAddLabor = useCan(PERM.posCostsLabor)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [chefMode, setChefMode] = useState(false)

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

  const active = data.tables.find((t) => t.id === activeId)
  if (active && canOrder) {
    return (
      <TableView
        table={active}
        onUpdate={(updater) => pos.updateTable(active.id, updater)}
        onBack={() => setActiveId(null)}
        onPaid={(payment) => payAndClose(active.id, payment)}
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
                const ready = t.items.reduce((s, it) => s + Math.max(0, (it.done || 0) - (it.served || 0)), 0)
                const cooking = t.items.reduce((s, it) => s + Math.max(0, (it.sent || 0) - (it.done || 0)), 0)
                return (
                  <button
                    key={t.id}
                    className="pos-tap"
                    style={S.tableCard}
                    onClick={() => { if (canOrder) { pos.serveReady(t.id); setActiveId(t.id) } }}
                  >
                    <div style={S.tableCardHead}>
                      <span style={{ ...S.tableNumBadge, background: t.useOH ? SEA : SUN }}>{t.num}</span>
                      <span style={S.tableName}>{t.name || tr('שולחן', 'طاولة') + ' ' + t.num}</span>
                    </div>
                    <span style={S.tableMeta}>{tt.headcount + ' ' + tr('סועדים', 'ضيوف') + ' · ' + tt.itemsCount + ' ' + tr('פריטים', 'أصناف')}</span>
                    {ready > 0 ? (
                      <span style={S.kitchenReady}>{'🔔 ' + ready + ' ' + tr('מוכן להגשה', 'جاهز للتقديم')}</span>
                    ) : cooking > 0 ? (
                      <span style={S.kitchenBadge}>{'🍳 ' + cooking + ' ' + tr('במטבח', 'في المطبخ')}</span>
                    ) : null}
                    <div style={S.tableCardTotal}>
                      <span style={S.tableCardNum}>{tt.grand}</span>
                      <span style={S.tableCardCur}>₪</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          <div style={{ height: 120 }} />
        </div>

        <div style={S.homeDock}>
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
          full={canReports}
          canAddFood={canAddFood}
          canAddLabor={canAddLabor}
          canManage={canManage}
          closed={data.closed}
          byName={user?.email ?? 'staff'}
          onReopen={reopen}
          onClear={pos.clearToday}
          onClose={() => setShowReport(false)}
        />
      )}
    </>
  )
}
