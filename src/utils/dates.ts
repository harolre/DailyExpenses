import type { RecurringItem } from '../models/entities'

export function monthKey(date: Date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function localDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 9)
}

export function advanceRecurringDate(value: string, frequency: RecurringItem['frequency'], anchorDay?: number) {
  const date = localDate(value)
  if (frequency === 'weekly') date.setDate(date.getDate() + 7)
  else if (frequency === 'biweekly') date.setDate(date.getDate() + 14)
  else {
    const delta = frequency === 'yearly' ? 12 : 1
    const day = anchorDay ?? date.getDate()
    date.setDate(1)
    date.setMonth(date.getMonth() + delta)
    date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()))
  }
  return dateKey(date)
}

export function recurringDatesInMonth(item: RecurringItem, month: Date) {
  const monthStart = `${monthKey(month)}-01`
  const monthEnd = dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0))
  const dates: string[] = []
  let date = item.nextDate
  let steps = 0
  while (date < monthStart && steps < 12000) {
    date = advanceRecurringDate(date, item.frequency, item.anchorDay)
    steps += 1
  }
  while (date <= monthEnd && steps < 12000) {
    dates.push(date)
    date = advanceRecurringDate(date, item.frequency, item.anchorDay)
    steps += 1
  }
  return dates
}

export function dateKey(date: Date = new Date()) {
  return `${monthKey(date)}-${String(date.getDate()).padStart(2, '0')}`
}

export function monthLabel(date: Date) {
  return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    .replace(/^\p{L}/u, letter => letter.toLocaleUpperCase('es-ES'))
    .replace(/\bDe\b/g, 'de')
}
