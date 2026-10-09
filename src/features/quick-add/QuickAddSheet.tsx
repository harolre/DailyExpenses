import { useEffect, useState } from 'react'

type QuickAddSheetProps = {
  onClose: () => void
  onAddExpense: () => void
  onAddIncome: () => void
  onAddTransfer: () => void
  onAddRecurringExpense: () => void
  onAddRecurringIncome: () => void
}

type MovementKind = 'expense' | 'income'

export function QuickAddSheet({ onClose, onAddExpense, onAddIncome, onAddTransfer, onAddRecurringExpense, onAddRecurringIncome }: QuickAddSheetProps) {
  const [kind, setKind] = useState<MovementKind | null>(null)
  const handleSelect = (onSelect: () => void) => () => {
    onClose()
    onSelect()
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (kind) setKind(null)
        else onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.classList.add('has-modal-open')

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.classList.remove('has-modal-open')
    }
  }, [kind, onClose])

  const isExpense = kind === 'expense'
  const actions = kind
    ? [
        { icon: isExpense ? '↗' : '↙', title: `${isExpense ? 'Gasto' : 'Ingreso'} rápido`, description: 'Registrar un movimiento ahora', onSelect: handleSelect(isExpense ? onAddExpense : onAddIncome) },
        { icon: '↻', title: `${isExpense ? 'Gasto' : 'Ingreso'} recurrente`, description: 'Preparar un movimiento periódico', onSelect: handleSelect(isExpense ? onAddRecurringExpense : onAddRecurringIncome) },
      ]
    : [
        { icon: '↗', title: 'Gasto', description: 'Añadir un gasto', onSelect: () => setKind('expense') },
        { icon: '↙', title: 'Ingreso', description: 'Añadir un ingreso', onSelect: () => setKind('income') },
      ]

  return (
    <div className="quick-add-overlay">
      <button className="quick-add-backdrop" type="button" aria-label="Cerrar menú" onClick={onClose} />
      <section
        id="quick-add-sheet"
        className="quick-add-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-title"
        aria-describedby="quick-add-description"
      >
        <div className="sheet-grabber" aria-hidden="true" />
        <header className="quick-add-header">
          <div>
            <p className="eyebrow">{kind ? (isExpense ? 'Nuevo gasto' : 'Nuevo ingreso') : 'Acceso rápido'}</p>
            <h2 id="quick-add-title">{kind ? `¿Qué tipo de ${isExpense ? 'gasto' : 'ingreso'}?` : 'Nuevo movimiento'}</h2>
            <p id="quick-add-description">{kind ? 'Elige cómo quieres registrarlo.' : 'Elige qué quieres añadir a tus finanzas.'}</p>
          </div>
          <div className="quick-add-header-actions">
            {kind&&<button className="quick-add-back" type="button" onClick={()=>setKind(null)} aria-label="Volver">‹</button>}
            <button className="sheet-close" type="button" aria-label="Cerrar menú" onClick={onClose}>×</button>
          </div>
        </header>
        <div className="quick-add-actions">
          {actions.map((action) => (
            <button className="quick-add-action" type="button" key={action.title} onClick={action.onSelect}>
              <span className="quick-add-icon" aria-hidden="true">{action.icon}</span>
              <span className="quick-add-copy"><span className="quick-add-title">{action.title}</span><span className="quick-add-description">{action.description}</span></span>
            </button>
          ))}
        </div>
        {!kind&&<button className="quick-add-transfer" type="button" onClick={handleSelect(onAddTransfer)}><span aria-hidden="true">⇄</span> Hacer una transferencia</button>}
      </section>
    </div>
  )
}
