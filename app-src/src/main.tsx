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

void start()
