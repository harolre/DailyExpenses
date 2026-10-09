import { useState } from 'react'
import { useFinanceData } from '../../hooks/useFinanceData'
import { saveRecurring, today } from '../../services/finance'
import { AccountRequiredNotice } from '../../components/AccountRequiredNotice'

type RecurringFormProps = { kind: 'expense' | 'income'; onBack: () => void; onGoToAccounts: () => void }

function localDateValue() {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function RecurringForm({ kind, onBack, onGoToAccounts }: RecurringFormProps) {
  const { accounts, categories } = useFinanceData()
  const activeAccounts=accounts.filter(a=>a.active)
  const isIncome = kind === 'income'
  const [reminder, setReminder] = useState('3')

  return (
    <div className="page expense-page">
      <header className="form-header">
        <button className="back-button" type="button" onClick={onBack} aria-label="Volver a Inicio">
          <span aria-hidden="true">‹</span> Inicio
        </button>
        <p className="eyebrow">Movimiento periódico</p>
        <h1>{isIncome ? 'Ingreso recurrente' : 'Gasto recurrente'}</h1>
        <p className="page-detail">Configura una previsión y su recordatorio.</p>
      </header>

      {activeAccounts.length===0?<AccountRequiredNotice activeCount={0} onAddAccount={onGoToAccounts}/>:<form className="expense-form" onSubmit={async (event) => { event.preventDefault(); const f=new FormData(event.currentTarget); const accountId=String(f.get('accountId')||''); const amount=Number(f.get('amount')); if(!accountId||!amount)return; const r=String(f.get('reminder')); await saveRecurring({kind,concept:String(f.get('concept')),amount,accountId,categoryId:String(f.get('categoryId')||'')||undefined,frequency:String(f.get('frequency')) as 'weekly'|'biweekly'|'monthly'|'yearly',nextDate:String(f.get('next-date'))||today(),reminder:r==='none'?null:r==='custom'?Number(f.get('custom-reminder-days')):Number(r),note:String(f.get('note')||'')}); onBack() }}>
        <label className="form-field">
          <span>Concepto</span>
          <input name="concept" type="text" placeholder={isIncome ? '¿Qué ingreso esperas?' : '¿Qué pago se repite?'} autoComplete="off" />
        </label>

        <label className="form-field amount-field">
          <span>Importe estimado</span>
          <span className="amount-input-wrap"><input name="amount" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00" /><span aria-hidden="true">€</span></span>
        </label>

        <label className="form-field">
          <span>Frecuencia</span>
          <select name="frequency" defaultValue="monthly">
            <option value="weekly">Cada semana</option>
            <option value="biweekly">Cada dos semanas</option>
            <option value="monthly">Cada mes</option>
            <option value="yearly">Cada año</option>
          </select>
        </label>

        <label className="form-field">
          <span>{isIncome ? 'Próximo ingreso esperado' : 'Próximo pago esperado'}</span>
          <input name="next-date" type="date" defaultValue={localDateValue()} />
        </label>

        <label className="form-field">
          <span>Categoría</span>
          <select name="categoryId" defaultValue=""><option value="">Sin categoría</option>{categories.filter(c=>c.kind===kind&&c.active).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>

        <label className="form-field"><span>Cuenta</span><select name="accountId" defaultValue="" required><option value="" disabled>Elige una cuenta</option>{activeAccounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>

        <label className="form-field">
          <span>Recordatorio</span>
          <select name="reminder" value={reminder} onChange={(event) => setReminder(event.target.value)}>
            <option value="none">Sin recordatorio</option>
            <option value="1">1 día antes</option>
            <option value="2">2 días antes</option>
            <option value="3">3 días antes</option>
            <option value="5">5 días antes</option>
            <option value="7">7 días antes</option>
            <option value="custom">Personalizado</option>
          </select>
          <span className="field-hint">Puedes cambiarlo en cualquier momento.</span>
        </label>

        {reminder === 'custom' && (
          <label className="form-field custom-reminder-field">
            <span>Días de antelación</span>
          <input name="custom-reminder-days" type="number" min="1" step="1" required={reminder === 'custom'} inputMode="numeric" placeholder="Por ejemplo, 10" />
          </label>
        )}

        <label className="form-field">
          <span>Nota <span className="optional-label">Opcional</span></span>
          <textarea name="note" rows={3} placeholder="Añade un detalle si lo necesitas" />
        </label>

        <div className="recurring-note">
          <span aria-hidden="true">↻</span>
          {isIncome
            ? 'Los ingresos previstos no se añadirán al saldo hasta que los marques como recibidos.'
            : 'El saldo de la cuenta cambiará al registrar el pago. Mientras tanto, este importe se descuenta del disponible real y aparece como previsto en el calendario.'}
        </div>

        <div className="form-footer">
          <button className="primary-button" type="submit" disabled={!accounts.some(a=>a.active)}>{isIncome ? 'Guardar ingreso recurrente' : 'Guardar gasto recurrente'}</button>
        </div>
      </form>}
    </div>
  )
}
