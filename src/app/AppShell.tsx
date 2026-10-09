import { useState, type ReactNode } from 'react'
import { navigationItems, type NavigationItem } from './navigation'
import { QuickAddSheet } from '../features/quick-add/QuickAddSheet'

type AppShellProps = {
  activeItem: NavigationItem
  onNavigate: (item: NavigationItem) => void
  isSubpage: boolean
  onAddExpense: () => void
  onAddIncome: () => void
  onAddTransfer: () => void
  onAddRecurringExpense: () => void
  onAddRecurringIncome: () => void
  children: ReactNode
}

export function AppShell({ activeItem, onNavigate, isSubpage, onAddExpense, onAddIncome, onAddTransfer, onAddRecurringExpense, onAddRecurringIncome, children }: AppShellProps) {
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)

  return (
    <div className="app-shell">
      <main className={`main-content${isSubpage ? ' is-subpage' : ''}`} key={activeItem}>
        {children}
      </main>
      {activeItem === 'inicio' && !isSubpage && (
        <button
          className={`add-button${isQuickAddOpen ? ' is-open' : ''}`}
          type="button"
          aria-label={isQuickAddOpen ? 'Cerrar menú de movimientos' : 'Añadir movimiento'}
          aria-expanded={isQuickAddOpen}
          aria-controls="quick-add-sheet"
          onClick={() => setIsQuickAddOpen((open) => !open)}
        >
          <span aria-hidden="true">{isQuickAddOpen ? '×' : '+'}</span>
        </button>
      )}
      {isQuickAddOpen && <QuickAddSheet onClose={() => setIsQuickAddOpen(false)} onAddExpense={onAddExpense} onAddIncome={onAddIncome} onAddTransfer={onAddTransfer} onAddRecurringExpense={onAddRecurringExpense} onAddRecurringIncome={onAddRecurringIncome} />}
      {!isSubpage && <nav className="tab-bar" aria-label="Navegación principal">
        {navigationItems.map((item) => (
          <button
            className={`tab-item${activeItem === item.id ? ' is-active' : ''}`}
            type="button"
            key={item.id}
            aria-current={activeItem === item.id ? 'page' : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <span className="tab-icon" aria-hidden="true">{item.icon}</span>
            <span className="tab-label">{item.label}</span>
          </button>
        ))}
      </nav>}
    </div>
  )
}
