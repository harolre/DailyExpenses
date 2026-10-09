import { useState, type FormEvent } from 'react'
import { database } from '../../data/database'
import type { Account } from '../../models/entities'

type AccountKind = Account['kind']
const accountKinds: { id: AccountKind; label: string; icon: string }[] = [
  { id: 'bank', label: 'Banco', icon: '▤' },
  { id: 'savings', label: 'Ahorro', icon: '◈' },
  { id: 'cash', label: 'Efectivo', icon: '€' },
  { id: 'card', label: 'Tarjeta', icon: '▭' },
]

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [profileName, setProfileName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [kind, setKind] = useState<AccountKind>('bank')
  const [balance, setBalance] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function finish(withAccount: boolean) {
    const name = profileName.trim()
    if (!name) { setStep(1); setError('Escribe un nombre para tu perfil.'); return }
    const accountLabel = accountName.trim()
    if (withAccount && !accountLabel) { setError('Escribe un nombre para la cuenta o continúa sin añadirla.'); return }
    const openingBalance = balance.trim() ? Number(balance.replace(',', '.')) : 0
    if (withAccount && (!Number.isFinite(openingBalance) || openingBalance < 0)) { setError('Introduce un saldo inicial válido, igual o superior a cero.'); return }

    setSaving(true)
    setError('')
    const createdAt = new Date().toISOString()
    try {
      await database.transaction('rw', [database.profiles, database.accounts], async () => {
        await database.profiles.put({ id: 'local', name, currency: 'EUR', createdAt })
        if (withAccount) await database.accounts.add({ id: crypto.randomUUID(), name: accountLabel, kind, balance: openingBalance, active: true, createdAt })
      })
      onComplete()
    } catch {
      setError('No se pudo guardar la configuración. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  function continueToAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profileName.trim()) { setError('Escribe tu nombre para continuar.'); return }
    setError('')
    setStep(2)
  }

  return <main className="onboarding-page">
    <div className="onboarding-brand" aria-hidden="true">€</div>
    <p className="eyebrow">TU ESPACIO FINANCIERO</p>
    <div className="onboarding-progress" aria-label={`Paso ${step} de 2`}><i className={step === 1 ? 'active' : 'complete'}/><i className={step === 2 ? 'active' : ''}/></div>
    {step === 1 ? <>
      <p className="onboarding-step-label">PASO 1 DE 2</p>
      <h1>Empecemos por tu perfil</h1>
      <p className="onboarding-description">Crea tu espacio personal para organizar tus cuentas y movimientos.</p>
      <form className="onboarding-form" onSubmit={continueToAccount}>
        <label className="form-field"><span>¿Cómo te llamamos?</span><input autoFocus autoComplete="name" maxLength={60} required value={profileName} onChange={event => setProfileName(event.target.value)} placeholder="Tu nombre"/></label>
        <div className="onboarding-local-note"><span aria-hidden="true">ⓘ</span><p>Tu perfil se guarda únicamente en este dispositivo. No necesitas crear una cuenta online.</p></div>
        {error && <p className="field-hint" role="alert">{error}</p>}
        <button className="primary-button" type="submit">Continuar</button>
      </form>
    </> : <>
      <button className="onboarding-back" type="button" onClick={() => { setError(''); setStep(1) }}>‹ Perfil</button>
      <p className="onboarding-step-label">PASO 2 DE 2</p>
      <h1>Añade tu primera cuenta</h1>
      <p className="onboarding-description">Puede ser tu banco, una cuenta de ahorro o efectivo. También puedes hacerlo más tarde.</p>
      <form className="onboarding-form" onSubmit={event => { event.preventDefault(); void finish(true) }}>
        <label className="form-field"><span>Tipo de cuenta</span></label>
        <div className="onboarding-account-kinds">{accountKinds.map(item => <button type="button" key={item.id} className={`onboarding-kind${kind === item.id ? ' selected' : ''}`} aria-pressed={kind === item.id} onClick={() => setKind(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</div>
        <label className="form-field"><span>Nombre de la cuenta</span><input autoFocus maxLength={60} required value={accountName} onChange={event => setAccountName(event.target.value)} placeholder={kind === 'bank' ? 'Ej. Cuenta principal' : kind === 'savings' ? 'Ej. Ahorro' : kind === 'cash' ? 'Ej. Efectivo' : 'Ej. Tarjeta habitual'}/></label>
        <label className="form-field"><span>Saldo actual <small className="optional-label">Opcional</small></span><span className="amount-input-wrap"><input inputMode="decimal" type="number" min="0" step="0.01" value={balance} onChange={event => setBalance(event.target.value)} placeholder="0,00"/><span>€</span></span></label>
        <div className="onboarding-local-note"><span aria-hidden="true">ⓘ</span><p>Es una cuenta manual. La app no se conecta a tu banco ni solicita tus claves.</p></div>
        {error && <p className="field-hint" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Crear mi espacio'}</button>
        <button className="onboarding-skip" type="button" disabled={saving} onClick={() => void finish(false)}>Continuar sin cuenta</button>
      </form>
    </>}
  </main>
}
