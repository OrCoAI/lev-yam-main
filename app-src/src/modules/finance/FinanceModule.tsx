import { useState } from 'react'
import { useCan, PERM } from '../../lib/permissions'
import CategoriesTab from './CategoriesTab'
import EntriesTab from './EntriesTab'
import ExpectedTab from './ExpectedTab'
import { useFT } from './i18n'
import ReconcileTab from './ReconcileTab'
import { useReconciliation } from './reconciliation'
import ReportTab from './ReportTab'

type Tab = 'entries' | 'expected' | 'report' | 'recon' | 'categories'

export default function FinanceModule() {
  const ft = useFT()
  const canManage = useCan(PERM.financeManage)
  // owner-only: editing the taxonomy reshapes every historical report
  const canEditCategories = useCan(PERM.financeCategories)
  const [tab, setTab] = useState<Tab>('entries')
  // ONE fetch for the module: the banner, the tab badge and the reconcile list
  // all read it, so posting a day refreshes every surface at once instead of
  // leaving the badge showing the pre-fix number. (The route is already behind
  // RequirePermission finance.view, so there is nothing to gate here.)
  const recon = useReconciliation()
  const drift = recon.data?.count ?? 0

  return (
    <section>
      <h1 className="page-title">{ft.title}</h1>
      {!canManage && (
        <p className="notice">
          {ft.viewOnly} ({PERM.financeManage})
        </p>
      )}

      <div className="tabs">
        <button className={tab === 'entries' ? 'tab on' : 'tab'} onClick={() => setTab('entries')}>
          {ft.tabEntries}
        </button>
        <button className={tab === 'expected' ? 'tab on' : 'tab'} onClick={() => setTab('expected')}>
          {ft.tabExpected}
        </button>
        <button className={tab === 'report' ? 'tab on' : 'tab'} onClick={() => setTab('report')}>
          {ft.tabReport}
        </button>
        <button className={tab === 'recon' ? 'tab on' : 'tab'} onClick={() => setTab('recon')}>
          {ft.tabRecon}
          {drift > 0 && <span className="badge badge-drift">{drift}</span>}
        </button>
        {canEditCategories && (
          <button
            className={tab === 'categories' ? 'tab on' : 'tab'}
            onClick={() => setTab('categories')}
          >
            {ft.tabCategories}
          </button>
        )}
      </div>

      {/* the banner leads wherever you are in the module — an unposted day is
          not something you should have to open a tab to discover */}
      {drift > 0 && tab !== 'recon' && (
        <button type="button" className="finance-recon-banner" onClick={() => setTab('recon')}>
          <span>⚠ {ft.reconBanner(String(drift))}</span>
          <span className="finance-recon-banner-go">{ft.reconBannerGo} ←</span>
        </button>
      )}

      {tab === 'entries' && <EntriesTab canManage={canManage} />}
      {tab === 'expected' && <ExpectedTab canManage={canManage} />}
      {tab === 'report' && <ReportTab />}
      {tab === 'recon' && <ReconcileTab recon={recon} onGoExpected={() => setTab('expected')} />}
      {tab === 'categories' && canEditCategories && <CategoriesTab />}
    </section>
  )
}
