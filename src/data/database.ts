import Dexie, { type EntityTable } from 'dexie'
import type { Account, Budget, Category, DocumentRecord, Movement, Profile, RecurringItem, TrashRecord } from '../models/entities'

class FinanceDatabase extends Dexie {
  profiles!: EntityTable<Profile, 'id'>
  accounts!: EntityTable<Account, 'id'>
  categories!: EntityTable<Category, 'id'>
  movements!: EntityTable<Movement, 'id'>
  recurringItems!: EntityTable<RecurringItem, 'id'>
  budgets!: EntityTable<Budget, 'id'>
  documents!: EntityTable<DocumentRecord, 'id'>
  trash!: EntityTable<TrashRecord, 'id'>

  constructor() {
    super('finanzas-personales')
    this.version(1).stores({
      profiles: 'id',
      accounts: 'id',
      categories: 'id',
      movements: 'id',
      recurringItems: 'id',
      budgets: 'id',
      documents: 'id',
    })
    this.version(2).stores({
      profiles: 'id', accounts: 'id, active', categories: 'id, kind, active',
      movements: 'id, kind, status, date, accountId, categoryId',
      recurringItems: 'id, kind, active, nextDate', budgets: 'id, month, categoryId', documents: 'id, movementId',
    })
    this.version(3).stores({
      profiles: 'id', accounts: 'id, active', categories: 'id, kind, active',
      movements: 'id, kind, status, date, accountId, categoryId, &[recurringItemId+recurrenceDate]',
      recurringItems: 'id, kind, active, nextDate', budgets: 'id, month, categoryId', documents: 'id, movementId',
    })
    this.version(4).stores({
      profiles: 'id', accounts: 'id, active', categories: 'id, kind, active',
      movements: 'id, kind, status, date, accountId, categoryId, &[recurringItemId+recurrenceDate]',
      recurringItems: 'id, kind, active, nextDate', budgets: 'id, month, categoryId', documents: 'id, movementId', trash: 'id, deletedAt',
    })
  }
}

export const database = new FinanceDatabase()
