import { useState } from 'react'
import { useCan, PERM } from '../../lib/permissions'
import CategoriesTab from './CategoriesTab'
import EntriesTab from './EntriesTab'
import ExpectedTab from './ExpectedTab'
import { useFT } from './i18n'
import ReportTab from './ReportTab'

type Tab = 'entries' | 'expected' | 'report' | 'categories'

export default function FinanceModule() {
  const ft = useFT()
  const canManage = useCan(PERM.financeManage)
  // owner-only: editing the taxonomy reshapes every historical report
  const canEditCategories = useCan(PERM.financeCategories)
  const [tab, setTab] = useState<Tab>('entries')

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
        {canEditCategories && (
          <button
            className={tab === 'categories' ? 'tab on' : 'tab'}
            onClick={() => setTab('categories')}
          >
            {ft.tabCategories}
          </button>
        )}
      </div>

      {tab === 'entries' && <EntriesTab canManage={canManage} />}
      {tab === 'expected' && <ExpectedTab canManage={canManage} />}
      {tab === 'report' && <ReportTab />}
      {tab === 'categories' && canEditCategories && <CategoriesTab />}
    </section>
  )
}
