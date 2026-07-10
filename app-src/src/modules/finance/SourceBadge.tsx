import { sourceLabel } from './categories'

// Provenance badge for module-posted rows (finance.entries / finance.expected).
export default function SourceBadge({
  module,
  sourceRef,
}: {
  module: string | null
  sourceRef: string | null
}) {
  if (!module) return null
  return (
    <span className="finance-badge" title={sourceRef ?? undefined}>
      {sourceLabel(module)}
    </span>
  )
}
