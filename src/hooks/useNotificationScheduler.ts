import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { database } from '../data/database'
import { checkRecurringReminders } from '../services/notifications'

export function useNotificationScheduler(enabled = true) {
  const recurring = useLiveQuery(() => database.recurringItems.toArray(), [], [])
  useEffect(() => {
    if (!enabled) return
    let active = true
    const check = () => { if (active) void checkRecurringReminders(recurring) }
    check()
    const timer = window.setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', check) }
  }, [recurring, enabled])
}
