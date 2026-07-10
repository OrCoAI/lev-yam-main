import { useState } from 'react'
import { useCan, PERM } from '../../lib/permissions'
import EntriesTab from './EntriesTab'
import ExpectedTab from './ExpectedTab'
import ReportTab from './ReportTab'

type Tab = 'entries' | 'expected' | 'report'

export default function FinanceModule() {
  const canManage = useCan(PERM.financeManage)
  const [tab, setTab] = useState<Tab>('entries')

  return (
    <section>
      <h1 className="page-title">כספים</h1>
      {!canManage && (
        <p className="notice">תצוגה בלבד — אין לך הרשאת ניהול ({PERM.financeManage}).</p>
      )}

      <div className="tabs">
        <button className={tab === 'entries' ? 'tab on' : 'tab'} onClick={() => setTab('entries')}>
          תנועות
        </button>
        <button className={tab === 'expected' ? 'tab on' : 'tab'} onClick={() => setTab('expected')}>
          צפי
        </button>
        <button className={tab === 'report' ? 'tab on' : 'tab'} onClick={() => setTab('report')}>
          דוח
        </button>
      </div>

      {tab === 'entries' && <EntriesTab canManage={canManage} />}
      {tab === 'expected' && <ExpectedTab canManage={canManage} />}
      {tab === 'report' && <ReportTab />}
    </section>
  )
}
