import { useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'

/** The view-as preview ends at the shell boundary: the full-screen POS route
 *  (outside Layout) hard-sizes itself to 100dvh, so a banner would either
 *  break its dock layout or cover its header — instead, entering POS simply
 *  exits the preview and renders with the admin's real permissions. The
 *  target's POS capabilities are inspectable in the matrix by-user lens. */
export function ExitPreviewOnEntry() {
  const { preview, stopPreview } = useAuth()
  useEffect(() => {
    if (preview) stopPreview()
  }, [preview, stopPreview])
  return null
}

/** Always-visible strip while a view-as preview is active — nobody should ever
 *  wonder whose permissions the screen is rendering. Mounted first in Layout;
 *  the topbar sticks below it (styles.css :has offset). */
export default function PreviewBanner() {
  const { preview, stopPreview } = useAuth()
  const { t } = useI18n()
  if (!preview) return null
  return (
    <div className="preview-banner" role="status">
      <span>
        {t('preview.viewingAs')} <strong>{preview.email}</strong>
      </span>
      <button className="btn-ghost" onClick={stopPreview}>
        {t('preview.exit')}
      </button>
    </div>
  )
}
