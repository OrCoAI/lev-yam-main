// Small shared POS widgets, ported from pos.html.
import { useI18n } from '../../lib/i18n'
import { usePosTr } from './i18n'
import S from './styles'
import type { PosLine } from './types'

export function Line({ label, val }: { label: string; val: number }) {
  return (
    <div style={S.line}>
      <span style={S.lineLbl}>{label}</span>
      <span style={S.lineVal}>{val} ₪</span>
    </div>
  )
}

export function Stepper({ label, value, onMinus, onPlus }: {
  label: string
  value: number
  onMinus: () => void
  onPlus: () => void
}) {
  return (
    <div style={S.stepper}>
      <span style={S.stepLbl}>{label}</span>
      <div style={S.stepCtl}>
        <button className="pos-tap" style={S.stepBtn} onClick={onMinus}>–</button>
        <span style={S.stepNum}>{value}</span>
        <button className="pos-tap" style={S.stepBtn} onClick={onPlus}>+</button>
      </div>
    </div>
  )
}

export function TotalCell({ label, val, color, cur }: {
  label: string
  val: number
  color: string
  cur?: string
}) {
  const unit = cur === undefined ? '₪' : cur // pass cur:"" for a plain count (e.g. people)
  return (
    <div style={S.totalCell}>
      <span style={{ ...S.totalCellNum, color }}>
        {val}
        {unit && <span style={S.totalCellCur}> {unit}</span>}
      </span>
      <span style={S.totalCellLbl}>{label}</span>
    </div>
  )
}

// Pale kitchen-state chips (cooking / ready / served), each shown when present
// so the full pipeline state is legible. `emoji` adds the 🔔/🍳/✓ prefix (used
// by the table-level strip); the per-line StatusChip omits it. One place owns
// the state → label → style mapping for both callers.
export function KitchenChips({ cooking, ready, served, emoji }: {
  cooking: number
  ready: number
  served: number
  emoji?: boolean
}) {
  const { tr } = usePosTr()
  if (!cooking && !ready && !served) return null
  return (
    <span style={S.statusChips}>
      {ready > 0 && <span style={S.stReady}>{(emoji ? '🔔 ' : '') + tr('מוכן', 'جاهز')} ×{ready}</span>}
      {cooking > 0 && <span style={S.stFired}>{(emoji ? '🍳 ' : '') + tr('במטבח', 'في المطبخ')} ×{cooking}</span>}
      {served > 0 && <span style={S.stServed}>{(emoji ? '✓ ' : '') + tr('הוגש', 'قُدّم')} ×{served}</span>}
    </span>
  )
}

// Kitchen-status badges for a single order line (waiter-facing).
export function StatusChip({ it }: { it: PosLine }) {
  return (
    <KitchenChips
      cooking={Math.max(0, (it.sent || 0) - (it.done || 0))}
      ready={Math.max(0, (it.done || 0) - (it.served || 0))}
      served={it.served || 0}
    />
  )
}

// pos.html's in-app language pill, wired to the SHELL's language state so the
// whole platform follows (one toggle, styled for the POS headers).
export function PosLangToggle() {
  const { lang, setLang } = useI18n()
  return (
    <button
      className="pos-tap"
      style={{ border: 'none', background: 'rgba(255,255,255,.2)', color: '#fff', fontSize: 13, fontWeight: 800, padding: '7px 13px', borderRadius: 20, cursor: 'pointer', whiteSpace: 'nowrap' }}
      onClick={() => setLang(lang === 'he' ? 'ar' : 'he')}
    >
      {lang === 'he' ? 'العربية' : 'עברית'}
    </button>
  )
}
