import { defineConfig } from 'vitest/config'

// Unit tests for the pure money-math and formatting helpers (work order G6.2, ADR 0020/0037).
// Hermetic on purpose: vitest runs Vite in mode "test", which would load app-src/.env.local —
// and lib/supabase.ts instantiates its client at import. Pinning the VITE_* vars to empty
// here (process.env wins over .env files) to an unroutable localhost port means no test can ever
// reach a real project, whatever a developer's .env.local points at. Node environment: nothing here touches the DOM.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    env: { VITE_SUPABASE_URL: 'http://127.0.0.1:1', VITE_SUPABASE_ANON_KEY: 'test-anon-placeholder' },
  },
})
