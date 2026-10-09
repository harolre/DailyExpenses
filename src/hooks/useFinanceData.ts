import { useLiveQuery } from 'dexie-react-hooks'
import { database } from '../data/database'
export function useFinanceData() {
  return useLiveQuery(async () => ({
    accounts: await database.accounts.toArray(),
    categories: await database.categories.toArray(),
    movements: await database.movements.orderBy('date').reverse().toArray(),
    recurringItems: await database.recurringItems.toArray(), budgets: await database.budgets.toArray(),
  }), [], { accounts: [], categories: [], movements: [], recurringItems: [], budgets: [] })
}
