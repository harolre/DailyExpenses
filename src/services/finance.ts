import { database } from '../data/database'
import type { Account, Category, Movement, RecurringItem, TrashRecord } from '../models/entities'

const expenseCategories = ['Vivienda', 'Alimentación', 'Transporte', 'Salud', 'Ocio', 'Compras', 'Servicios', 'Otros']
const incomeCategories = ['Salario', 'Ingresos extra', 'Inversiones', 'Regalos', 'Otros ingresos']
const uid = () => crypto.randomUUID()
export const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }

export async function ensureDefaults() {
  const createdAt = new Date().toISOString()
  const defaults: Category[] = [...expenseCategories.map((name) => ({ id: `expense-${name.toLowerCase()}`, name, kind: 'expense' as const, color: '#176b58', active: true, createdAt, isSystem: true })), ...incomeCategories.map((name) => ({ id: `income-${name.toLowerCase().replaceAll(' ', '-')}`, name, kind: 'income' as const, color: '#4d8c77', active: true, createdAt, isSystem: true }))]
  for (const category of defaults) {
    const existing = await database.categories.get(category.id)
    await database.categories.put(existing ? { ...category, createdAt: existing.createdAt, isSystem: true, active: true } : category)
  }
}

export async function addAccount(input: Pick<Account, 'name' | 'kind' | 'balance'>) {
  await database.accounts.add({ ...input, id: uid(), active: true, createdAt: new Date().toISOString() })
}
export async function addCategory(name: string, kind: Category['kind']) {
  await database.categories.add({ id: uid(), name, kind, color: '#176b58', active: true, createdAt: new Date().toISOString(), isSystem: false })
}

export function isBuiltInCategory(category: Category) {
  return category.isSystem === true || category.id.startsWith('expense-') || category.id.startsWith('income-')
}

export async function deleteUserCategory(id: string) {
  await database.transaction('rw', [database.categories, database.movements, database.recurringItems, database.budgets, database.trash], async () => {
    const category = await database.categories.get(id)
    if (!category || isBuiltInCategory(category)) return
    const fallbackId = category.kind === 'expense' ? 'expense-otros' : 'income-otros-ingresos'
    const fallback = await database.categories.get(fallbackId)
    if (!fallback) throw new Error('No se encontró la categoría Otros para trasladar los movimientos.')

    const movements = (await database.movements.toArray()).filter(m => m.categoryId === id)
    if (movements.length) await database.movements.bulkPut(movements.map(m => ({ ...m, categoryId: fallback.id })))
    const recurringItems = (await database.recurringItems.toArray()).filter(item => item.categoryId === id)
    if (recurringItems.length) await database.recurringItems.bulkPut(recurringItems.map(item => ({ ...item, categoryId: fallback.id })))

    const budgets = await database.budgets.where('categoryId').equals(id).toArray()
    for (const budget of budgets) {
      const existing = await database.budgets.where('categoryId').equals(fallback.id).filter(item => item.month === budget.month).first()
      if (existing) {
        await database.budgets.update(existing.id, { amount: existing.amount + budget.amount })
        await database.budgets.delete(budget.id)
      } else await database.budgets.update(budget.id, { categoryId: fallback.id })
    }

    const trashRecords = (await database.trash.toArray()).filter(record => record.movement.categoryId === id)
    if (trashRecords.length) await database.trash.bulkPut(trashRecords.map(record => ({ ...record, movement: { ...record.movement, categoryId: fallback.id } })))
    await database.categories.delete(id)
  })
}
export async function saveMovement(input: Omit<Movement, 'id' | 'createdAt'>, file?: File) {
  const id = uid()
  await database.transaction('rw', database.movements, database.accounts, database.documents, async () => {
    await database.movements.add({ ...input, id, createdAt: new Date().toISOString() })
    if (file) await database.documents.add({ id: uid(), movementId: id, name: file.name, type: file.type, blob: file, createdAt: new Date().toISOString() })
    if (input.status !== 'pending') {
      const change = input.kind === 'expense' ? -input.amount : input.kind === 'income' ? input.amount : 0
      if (input.accountId && change) { const account = await database.accounts.get(input.accountId); if (account) await database.accounts.update(input.accountId, { balance: account.balance + change }) }
      if (input.kind === 'transfer' && input.accountId && input.toAccountId) {
        const from = await database.accounts.get(input.accountId); const to = await database.accounts.get(input.toAccountId)
        if (from && to) { await database.accounts.update(from.id, { balance: from.balance - input.amount }); await database.accounts.update(to.id, { balance: to.balance + input.amount }) }
      }
    }
  })
}
export async function attachDocumentsToMovement(movementId: string, files: File[]) {
  if (!files.length || !(await database.movements.get(movementId))) return
  await database.documents.bulkAdd(files.map(file => ({ id: uid(), movementId, name: file.name, type: file.type, blob: file, createdAt: new Date().toISOString() })))
}
export async function saveRecurring(input: Omit<RecurringItem, 'id' | 'createdAt' | 'active'>) {
  await database.recurringItems.add({ ...input, anchorDay: Number(input.nextDate.slice(-2)), id: uid(), active: true, createdAt: new Date().toISOString() })
}
export async function updateRecurring(id: string, changes: Pick<RecurringItem, 'concept' | 'amount' | 'accountId' | 'categoryId' | 'frequency' | 'nextDate' | 'reminder' | 'note'>) {
  await database.recurringItems.update(id, { ...changes, anchorDay: Number(changes.nextDate.slice(-2)) })
}
async function changeMovementBalances(movement: Movement, multiplier: 1 | -1) {
  if (movement.status === 'pending') return
  const deltas = movement.kind === 'expense'
    ? (movement.accountId ? [[movement.accountId, -movement.amount] as const] : [])
    : movement.kind === 'income'
      ? (movement.accountId ? [[movement.accountId, movement.amount] as const] : [])
      : [[movement.accountId, -movement.amount] as const, [movement.toAccountId, movement.amount] as const].filter((entry): entry is readonly [string, number] => Boolean(entry[0]))
  for (const [accountId, amount] of deltas) {
    const account = await database.accounts.get(accountId)
    if (account) await database.accounts.update(accountId, { balance: account.balance + amount * multiplier })
  }
}
export async function moveMovementToTrash(id: string) {
  await database.transaction('rw', [database.movements, database.accounts, database.documents, database.trash, database.recurringItems], async () => {
    const movement = await database.movements.get(id)
    if (!movement) return
    const documents = await database.documents.where('movementId').equals(id).toArray()
    const record: TrashRecord = { id, movement, documents, deletedAt: new Date().toISOString() }
    await database.trash.put(record)
    await changeMovementBalances(movement, -1)
    await database.documents.where('movementId').equals(id).delete()
    await database.movements.delete(id)
    if (movement.recurringItemId) {
      const item = await database.recurringItems.get(movement.recurringItemId)
      const date = movement.recurrenceDate || movement.date
      if (item) await database.recurringItems.update(item.id, { skippedDates: [...new Set([...(item.skippedDates || []), date])] })
    }
  })
}
export async function skipRecurringOccurrence(recurringItemId: string, date: string) {
  const item = await database.recurringItems.get(recurringItemId)
  if (!item) return
  const occurrence = (await database.movements.where('recurringItemId').equals(recurringItemId).toArray())
    .find(movement => (movement.recurrenceDate || movement.date) === date)
  if (occurrence) await moveMovementToTrash(occurrence.id)
  const latest = await database.recurringItems.get(recurringItemId)
  if (!latest) return
  await database.recurringItems.update(recurringItemId, { skippedDates: [...new Set([...(latest.skippedDates || []), date])] })
}
export async function deleteRecurringFromDate(recurringItemId: string, fromDate: string) {
  await database.transaction('rw', [database.recurringItems, database.movements, database.accounts, database.documents, database.trash], async () => {
    const item = await database.recurringItems.get(recurringItemId)
    if (!item) return
    const futurePending = (await database.movements.where('recurringItemId').equals(recurringItemId).toArray())
      .filter(movement => (movement.recurrenceDate || movement.date) >= fromDate && movement.status === 'pending')
    for (const movement of futurePending) {
      const documents = await database.documents.where('movementId').equals(movement.id).toArray()
      await database.trash.put({ id: movement.id, movement, documents, deletedAt: new Date().toISOString() })
      await changeMovementBalances(movement, -1)
      await database.documents.where('movementId').equals(movement.id).delete()
      await database.movements.delete(movement.id)
    }
    await database.recurringItems.delete(recurringItemId)
  })
}
export async function restoreMovementFromTrash(id: string) {
  await database.transaction('rw', [database.movements, database.accounts, database.documents, database.trash, database.recurringItems], async () => {
    const record = await database.trash.get(id)
    if (!record || await database.movements.get(id)) return
    await database.movements.put(record.movement)
    if (record.movement.recurringItemId) {
      const recurringItem = await database.recurringItems.get(record.movement.recurringItemId)
      const date = record.movement.recurrenceDate || record.movement.date
      if (recurringItem?.skippedDates?.includes(date)) {
        await database.recurringItems.update(recurringItem.id, { skippedDates: recurringItem.skippedDates.filter(skippedDate => skippedDate !== date) })
      }
    }
    if (record.documents.length) await database.documents.bulkPut(record.documents)
    await changeMovementBalances(record.movement, 1)
    await database.trash.delete(id)
  })
}
export async function updateMovement(id: string, changes: Partial<Pick<Movement, 'concept' | 'amount' | 'categoryId' | 'accountId' | 'toAccountId' | 'date' | 'status' | 'note'>>) {
  await database.transaction('rw', [database.movements, database.accounts], async () => {
    const previous = await database.movements.get(id)
    if (!previous) return
    const updated = { ...previous, ...changes }
    await changeMovementBalances(previous, -1)
    await database.movements.put(updated)
    await changeMovementBalances(updated, 1)
  })
}
export async function refreshDatabase() { return Promise.all([database.accounts.toArray(), database.categories.toArray(), database.movements.toArray(), database.recurringItems.toArray(), database.budgets.toArray()]) }
