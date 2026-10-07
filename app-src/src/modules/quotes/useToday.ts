import { useEffect, useState } from 'react'

/** The current local date, read outside render (oxlint react/purity) and
 *  re-read just after midnight and whenever the tab becomes visible again
 *  (browsers hold timers back during sleep and in background tabs). */
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date())
  useEffect(() => {
    const midnight = new Date(today)
    midnight.setHours(24, 0, 0, 0)
    const t = setTimeout(() => setToday(new Date()), midnight.getTime() - Date.now() + 1000)
    return () => clearTimeout(t)
  }, [today])
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const now = new Date()
      setToday((prev) => (prev.toDateString() === now.toDateString() ? prev : now))
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
  return today
}
