import { database } from '../data/database'
import type { RecurringItem } from '../models/entities'
import { advanceRecurringDate } from '../utils/dates'

const enabledKey = 'finanzas.notifications.enabled'
const sentKey = 'finanzas.notifications.lastSent'
const readLocal = (key: string) => { try { return localStorage.getItem(key) } catch { return null } }
const writeLocal = (key: string, value: string) => { try { localStorage.setItem(key, value) } catch { /* Notifications can still be used for this session. */ } }

export function notificationsAvailable() { return typeof window !== 'undefined' && 'Notification' in window }
export function notificationsEnabled() { return readLocal(enabledKey) === 'true' }

export async function enableNotifications() {
  if (!notificationsAvailable()) return 'unsupported' as const
  const permission = await Notification.requestPermission()
  writeLocal(enabledKey, permission === 'granted' ? 'true' : 'false')
  return permission
}

export function disableNotifications() { writeLocal(enabledKey, 'false') }

async function showNotification(title: string, body: string, tag: string) {
  try {
    const options: NotificationOptions = { body, icon: '/favicon.svg', badge: '/favicon.svg', tag, data: { url: '/' } }
    const registration = await navigator.serviceWorker?.getRegistration().catch(() => undefined)
    if (registration?.showNotification) await registration.showNotification(title, options)
    else new Notification(title, options)
    return true
  } catch { return false }
}

export async function sendTestNotification() {
  if (!notificationsAvailable() || Notification.permission !== 'granted') return false
  return showNotification('Notificaciones activas', 'Te avisaremos sobre las fechas de tus movimientos recurrentes.', 'finanzas-test')
}

async function createPendingOccurrence(item: RecurringItem, date: string) {
  await database.transaction('rw', database.movements, async () => {
    const existing = await database.movements.where('[recurringItemId+recurrenceDate]').equals([item.id, date]).first()
    if (existing) return
    await database.movements.add({
      id: crypto.randomUUID(), kind: item.kind, concept: item.concept, amount: item.amount,
      categoryId: item.categoryId, accountId: item.accountId, recurringItemId: item.id,
      recurrenceDate: date, date, status: 'pending', note: item.note, createdAt: new Date().toISOString(),
    })
  })
}

async function sendReminder(item: RecurringItem, date: string, dueToday: boolean) {
  if (item.skippedDates?.includes(date)) return false
  const sent = JSON.parse(readLocal(sentKey) || '{}') as Record<string, string>
  if (sent[item.id] === date || Notification.permission !== 'granted') return false
  const kindLabel = item.kind === 'expense' ? 'pago' : 'ingreso'
  const amount = item.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
  const dayLabel = dueToday ? 'vence hoy' : `previsto para ${new Date(`${date}T12:00:00`).toLocaleDateString('es-ES')}`
  if (!await showNotification(`${item.concept}: ${kindLabel}`, `${amount} · ${dayLabel}`, `${item.id}-${date}`)) return false
  sent[item.id] = date
  writeLocal(sentKey, JSON.stringify(sent))
  return true
}

/** Creates a pending transaction once per due date, then advances the recurrence. */
export async function checkRecurringReminders(items: RecurringItem[]) {
  const now = new Date()
  for (const item of items) {
    if (!item.active) continue
    let due = item.nextDate
    let dueAt = new Date(`${due}T09:00:00`)

    if (notificationsEnabled() && notificationsAvailable() && Notification.permission === 'granted' && item.reminder !== null) {
      const remindAt = new Date(dueAt)
      remindAt.setDate(remindAt.getDate() - item.reminder)
      if (now >= remindAt && now <= new Date(dueAt.getTime() + 24 * 60 * 60 * 1000)) {
        await sendReminder(item, due, now >= dueAt)
      }
    }

    let occurrences = 0
    while (dueAt <= now && occurrences < 120) {
      if (!item.skippedDates?.includes(due)) await createPendingOccurrence(item, due)
      if (!item.skippedDates?.includes(due) && notificationsEnabled() && notificationsAvailable() && Notification.permission === 'granted' && item.reminder !== null && now <= new Date(dueAt.getTime() + 24 * 60 * 60 * 1000)) {
        await sendReminder(item, due, true)
      }
      due = advanceRecurringDate(due, item.frequency, item.anchorDay)
      dueAt = new Date(`${due}T09:00:00`)
      occurrences += 1
    }
    if (occurrences) await database.recurringItems.update(item.id, { nextDate: due })
  }
}
