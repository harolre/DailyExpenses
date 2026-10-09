import { useState } from 'react'
import { AccountRequiredNotice } from '../../components/AccountRequiredNotice'
import { useFinanceData } from '../../hooks/useFinanceData'
import { saveMovement, today } from '../../services/finance'

export function TransferForm({ onBack, onGoToAccounts }: { onBack: () => void; onGoToAccounts: () => void }) {
  const { accounts } = useFinanceData()
  const activeAccounts = accounts.filter(account => account.active)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const values = new FormData(event.currentTarget)
    const from = String(values.get('from'))
    const to = String(values.get('to'))
    const amount = Number(values.get('amount'))
    if (!from || !to || from === to || !Number.isFinite(amount) || amount <= 0) return

    const source = activeAccounts.find(account => account.id === from)
    if (!source) return
    if (amount > source.balance) {
      setError(`El importe supera el saldo disponible en ${source.name} (${source.balance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}).`)
      return
    }

    await saveMovement({
      kind: 'transfer',
      concept: 'Transferencia',
      amount,
      accountId: from,
      toAccountId: to,
      date: String(values.get('date')),
      status: 'paid',
      note: String(values.get('note') || ''),
    })
    onBack()
  }

  return <div className="page expense-page">
    <header className="form-header">
      <button className="back-button" type="button" onClick={onBack}>‹ Inicio</button>
      <p className="eyebrow">Nuevo movimiento</p>
      <h1>Transferencia</h1>
      <p className="page-detail">Mueve dinero entre tus cuentas.</p>
    </header>
    {activeAccounts.length < 2
      ? <AccountRequiredNotice activeCount={activeAccounts.length} minimum={2} onAddAccount={onGoToAccounts}/>
      : <form className="expense-form" onSubmit={submit}>
        <label className="form-field">
          <span>Desde</span>
          <select name="from" required defaultValue="" onChange={() => setError('')}>
            <option value="" disabled>Elige cuenta</option>
            {activeAccounts.map(account => <option value={account.id} key={account.id}>{account.name} · {account.balance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</option>)}
          </select>
        </label>
        <div className="transfer-direction">↓</div>
        <label className="form-field">
          <span>Hacia</span>
          <select name="to" required defaultValue="">
            <option value="" disabled>Elige cuenta</option>
            {activeAccounts.map(account => <option value={account.id} key={account.id}>{account.name}</option>)}
          </select>
        </label>
        <label className="form-field amount-field">
          <span>Importe</span>
          <span className="amount-input-wrap"><input name="amount" required type="number" min="0.01" step="0.01" placeholder="0,00" onChange={() => setError('')}/><span>€</span></span>
        </label>
        <label className="form-field"><span>Fecha</span><input name="date" required type="date" defaultValue={today()}/></label>
        <label className="form-field"><span>Nota <span className="optional-label">Opcional</span></span><textarea name="note" rows={3}/></label>
        <div className="transfer-note">La transferencia mueve el saldo entre cuentas, sin contar como gasto o ingreso.</div>
        <div className="form-footer"><button className="primary-button" type="submit">Transferir</button></div>
      </form>}
    {error && <div className="quick-add-overlay profile-success-overlay" role="presentation">
      <button className="quick-add-backdrop" type="button" aria-label="Cerrar aviso" onClick={() => setError('')}/>
      <section className="profile-success-dialog" role="alertdialog" aria-modal="true" aria-labelledby="transfer-limit-title" aria-describedby="transfer-limit-message">
        <span className="profile-success-icon" aria-hidden="true">!</span>
        <h2 id="transfer-limit-title">No se puede transferir</h2>
        <p id="transfer-limit-message">{error}</p>
        <button className="primary-button" type="button" autoFocus onClick={() => setError('')}>Aceptar</button>
      </section>
    </div>}
  </div>
}
