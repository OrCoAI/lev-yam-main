import { Link } from 'react-router-dom'
import { useFT } from './i18n'

// Provenance badge for module-posted rows (finance.entries / finance.expected).
// With an href it becomes a link to the page that owns the row (see
// provenance.ts) — corrections happen at the source, never here.
export default function SourceBadge({
  module,
  sourceRef,
  href,
}: {
  module: string | null
  sourceRef: string | null
  href?: string | null
}) {
  const ft = useFT()
  if (!module) return null
  const label = ft.sourceLabels[module] ?? module
  if (!href)
    return (
      <span className="finance-badge" title={sourceRef ?? undefined}>
        {label}
      </span>
    )
  return (
    <Link className="finance-badge finance-badge-link" to={href} title={sourceRef ?? undefined}>
      {label} <span aria-hidden="true">↗</span>
    </Link>
  )
}
