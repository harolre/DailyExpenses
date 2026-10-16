import { useEffect, useState } from 'react'
import { AppShell } from './AppShell'
import { HomePage } from '../features/home/HomePage'
import { ExpenseForm, IncomeForm } from '../features/movements/ExpenseForm'
import { TransferForm } from '../features/movements/TransferForm'
import { RecurringForm } from '../features/movements/RecurringForm'
import type { NavigationItem } from './navigation'
import { ensureDefaults } from '../services/finance'
import { FinancePage } from '../features/placeholder/FinancePages'
import { useNotificationScheduler } from '../hooks/useNotificationScheduler'
import { hasPin, removePin } from '../services/security'
import { LockScreen } from '../features/security/LockScreen'
import { database } from '../data/database'
import { Onboarding } from '../features/onboarding/Onboarding'
import { useThemePreference } from '../hooks/useThemePreference'

type ActiveForm = 'expense' | 'income' | 'transfer' | 'recurring-expense' | 'recurring-income' | null

export function App() {
  const [themePreference, setThemePreference] = useThemePreference()
  const [isLocked, setIsLocked] = useState(() => hasPin())
  useNotificationScheduler(!isLocked)
  const [activeItem, setActiveItem] = useState<NavigationItem>('inicio')
  const [activeForm, setActiveForm] = useState<ActiveForm>(null)
  const [accountsReturnForm, setAccountsReturnForm] = useState<ActiveForm>(null)
  const [openAccountsOnSettings, setOpenAccountsOnSettings] = useState(false)
  const [startup, setStartup] = useState<'loading' | 'setup' | 'ready' | 'error'>('loading')

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [activeForm])
  useEffect(() => {
    let mounted = true
    void ensureDefaults().then(async () => {
      const profile = await database.profiles.get('local')
      if (mounted) setStartup(profile ? 'ready' : 'setup')
    }).catch(() => { if (mounted) setStartup('error') })
    return () => { mounted = false }
  }, [])


  if (isLocked) return <LockScreen onUnlock={() => setIsLocked(false)} onReset={async () => {
    if (!window.confirm('Olvidar el PIN borrará también las cuentas y movimientos guardados en este dispositivo. ¿Quieres borrar los datos y configurar la app de nuevo?')) return
    await database.delete()
    removePin()
    window.location.reload()
  }} />

  if (startup === 'loading') return <main className="onboarding-page onboarding-loading" aria-live="polite"><div className="onboarding-brand" aria-hidden="true">€</div><p>Preparando tu espacio…</p></main>
  if (startup === 'error') return <main className="onboarding-page onboarding-loading"><div className="onboarding-brand" aria-hidden="true">!</div><h1>No se pudo abrir la aplicación</h1><p>Comprueba el almacenamiento del dispositivo y vuelve a cargar la página.</p><button className="primary-button" type="button" onClick={() => window.location.reload()}>Volver a intentar</button></main>
  if (startup === 'setup') return <Onboarding onComplete={() => setStartup('ready')} />

  const handleNavigate = (item: NavigationItem) => {
    setActiveItem(item)
    setActiveForm(null)
    setOpenAccountsOnSettings(false)
    setAccountsReturnForm(null)
  }
  const openAccountManagerFromForm = () => {
    setAccountsReturnForm(activeForm)
    setOpenAccountsOnSettings(true)
    setActiveItem('ajustes')
    setActiveForm(null)
  }
  const returnToFormAfterAccounts = () => {
    const formToResume=accountsReturnForm
    setAccountsReturnForm(null)
    setOpenAccountsOnSettings(false)
    setActiveItem('inicio')
    setActiveForm(formToResume)
  }
  const startTransferFromAccounts = () => {
    setOpenAccountsOnSettings(false)
    setAccountsReturnForm(null)
    setActiveItem('inicio')
    setActiveForm('transfer')
  }
  return (
    <AppShell
      activeItem={activeItem}
      onNavigate={handleNavigate}
      isSubpage={activeForm !== null}
      onAddExpense={() => setActiveForm('expense')}
      onAddIncome={() => setActiveForm('income')}
      onAddTransfer={() => setActiveForm('transfer')}
      onAddRecurringExpense={() => setActiveForm('recurring-expense')}
      onAddRecurringIncome={() => setActiveForm('recurring-income')}
    >
      {activeForm === 'expense'
        ? <ExpenseForm onBack={() => setActiveForm(null)} onGoToAccounts={openAccountManagerFromForm} />
        : activeForm === 'income'
          ? <IncomeForm onBack={() => setActiveForm(null)} onGoToAccounts={openAccountManagerFromForm} />
          : activeForm === 'transfer'
            ? <TransferForm onBack={() => setActiveForm(null)} onGoToAccounts={openAccountManagerFromForm} />
            : activeForm === 'recurring-expense'
              ? <RecurringForm kind="expense" onBack={() => setActiveForm(null)} onGoToAccounts={openAccountManagerFromForm} />
              : activeForm === 'recurring-income'
                ? <RecurringForm kind="income" onBack={() => setActiveForm(null)} onGoToAccounts={openAccountManagerFromForm} />
                : activeItem === 'inicio'
                  ? <HomePage onNavigate={handleNavigate} />
                : <FinancePage section={activeItem} onLockNow={() => setIsLocked(true)} openAccountsOnLoad={openAccountsOnSettings} onAccountsClose={accountsReturnForm?returnToFormAfterAccounts:undefined} onStartTransfer={startTransferFromAccounts} themePreference={themePreference} onThemePreferenceChange={setThemePreference} />}
    </AppShell>
  )
}
