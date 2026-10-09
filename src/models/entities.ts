export type Profile = { id: 'local'; name: string; currency: 'EUR'; createdAt: string }
export type Account = { id: string; name: string; kind: 'cash' | 'bank' | 'card' | 'savings'; balance: number; active: boolean; createdAt: string }
export type Category = { id: string; name: string; kind: 'expense' | 'income'; color: string; active: boolean; createdAt: string; isSystem?: boolean }
export type Movement = { id: string; kind: 'expense' | 'income' | 'transfer'; concept: string; amount: number; categoryId?: string; accountId?: string; toAccountId?: string; recurringItemId?: string; recurrenceDate?: string; date: string; status: 'paid' | 'pending' | 'received'; note: string; createdAt: string }
export type RecurringItem = { id: string; kind: 'expense' | 'income'; concept: string; amount: number; categoryId?: string; accountId?: string; frequency: 'weekly' | 'biweekly' | 'monthly' | 'yearly'; nextDate: string; anchorDay?: number; reminder: number | null; note: string; active: boolean; createdAt: string; skippedDates?: string[] }
export type Budget = { id: string; categoryId: string; amount: number; month: string; createdAt: string }
export type DocumentRecord = { id: string; movementId: string; name: string; type: string; blob: Blob; createdAt: string }
export type TrashRecord = { id: string; movement: Movement; documents: DocumentRecord[]; deletedAt: string }
