import { useEffect, useState } from 'react'

/** The shell's phone breakpoint — keep in sync with the `@media (max-width: 640px)`
 *  blocks in styles.css. Modules use it to gate phone-only behavior (row disclosure,
 *  collapsed-by-default forms) so desktop keeps its always-visible layout. */
export const PHONE_MQ = '(max-width: 640px)'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', onChange)
    setMatches(mql.matches)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}
