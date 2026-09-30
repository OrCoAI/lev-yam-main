/* Where the public "What's happening" pages read their feed from.
   The CHECKOUT carries the local Supabase stack — local dev never touches
   prod (ADR 0004). scripts/gen-happening.mjs rewrites this file in _site/ from
   the tier's VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY at assemble time, so
   levyam.com reads the platform project and staging.levyam.com reads
   lev-yam-staging. The key is the anon/publishable one — safe in the browser;
   RLS and the column grants are the guard (docs/ARCHITECTURE.md invariant 2). */
window.LEVYAM_FEED = {
  url: 'http://127.0.0.1:54321',
  key: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
};
