// Entry indirection: in dev, `?preview` boots the in-memory Supabase mock
// (src/dev/) BEFORE any app module evaluates, so the UI can be exercised
// without a session or network. Production builds drop the branch entirely
// (import.meta.env.DEV is statically false) and boot the real app directly.
async function start() {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('preview')) {
    await import('./dev/mock-net')
  }
  await import('./boot')
}

start().catch((err) => {
  // A stale index.html after a redeploy 404s the old boot chunk — without this
  // the rejection is discarded and the user sees a silent blank page.
  console.error(err)
  const root = document.getElementById('root')
  if (root)
    root.innerHTML =
      '<div style="max-width:26rem;margin:20vh auto;padding:0 1.5rem;text-align:center;font-family:sans-serif;line-height:1.6">' +
      '<p dir="rtl">שגיאה בטעינת המערכת — ייתכן שעודכנה גרסה חדשה.</p>' +
      '<p dir="rtl">خطأ في تحميل النظام — ربما صدرت نسخة جديدة.</p>' +
      '<button style="padding:.5rem 1.5rem;cursor:pointer" onclick="location.reload()">רענון / تحديث</button>' +
      '</div>'
})
