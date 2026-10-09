import { useFinanceData } from '../../hooks/useFinanceData'
import { saveMovement, today } from '../../services/finance'
import type { Category } from '../../models/entities'
import { AccountRequiredNotice } from '../../components/AccountRequiredNotice'

type Props = { onBack: () => void; onGoToAccounts: () => void; kind: 'expense' | 'income' }
function MovementForm({ onBack, onGoToAccounts, kind }: Props) {
  const { accounts, categories } = useFinanceData()
  const activeAccounts=accounts.filter(a=>a.active)
  const filtered = categories.filter((c) => c.kind === kind && c.active)
  const income = kind === 'income'
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const f = new FormData(event.currentTarget)
    const amount = Number(f.get('amount')); const accountId = String(f.get('accountId') || '')
    if (!amount || amount <= 0 || !accountId) return
    const status = income ? String(f.get('status')) as 'pending' | 'received' : 'paid'
    const file=f.get('document'); await saveMovement({ kind, concept: String(f.get('concept')).trim(), amount, categoryId: String(f.get('categoryId') || '') || undefined, accountId, date: String(f.get('date')), status, note: String(f.get('note') || '') },file instanceof File&&file.size?file:undefined)
    onBack()
  }
  return <div className="page expense-page"><header className="form-header"><button className="back-button" type="button" onClick={onBack}>‹ Inicio</button><p className="eyebrow">Nuevo movimiento</p><h1>{income ? 'Nuevo ingreso' : 'Nuevo gasto'}</h1><p className="page-detail">{income ? 'Anota un ingreso recibido o esperado.' : 'Registra un gasto ya pagado.'}</p></header>
    {activeAccounts.length===0?<AccountRequiredNotice activeCount={0} onAddAccount={onGoToAccounts}/>:<form className="expense-form" onSubmit={submit}>
      <label className="form-field"><span>Concepto</span><input name="concept" required autoFocus placeholder={income ? '¿De dónde viene?' : '¿En qué has gastado?'} /></label>
      <label className="form-field amount-field"><span>Importe</span><span className="amount-input-wrap"><input name="amount" type="number" min="0.01" step="0.01" required inputMode="decimal" placeholder="0,00"/><span>€</span></span></label>
      <label className="form-field"><span>Categoría</span><select name="categoryId" defaultValue=""><option value="">Sin categoría</option>{filtered.map((c: Category)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="form-field"><span>Cuenta</span><select name="accountId" required defaultValue=""><option value="" disabled>Elige una cuenta</option>{activeAccounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <label className="form-field"><span>{income?'Fecha del ingreso':'Fecha del gasto'}</span><input name="date" type="date" defaultValue={today()} required /></label>
      {income&&<><fieldset className="status-field"><legend>Estado</legend><div className="status-options">{[['pending','Pendiente'],['received','Recibido']].map(([value,label])=><label className="status-option" key={value}><input type="radio" name="status" value={value} defaultChecked={value==='pending'}/><span className="status-dot"/>{label}</label>)}</div></fieldset><div className="pending-note">Los ingresos pendientes no se suman al saldo.</div></>}
      <label className="form-field"><span>Nota <span className="optional-label">Opcional</span></span><textarea name="note" rows={3}/></label>
      <label className="attachment-button"><span aria-hidden="true">＋</span> Añadir documento<input type="file" name="document" accept="image/*,.pdf" hidden/></label>
      <div className="form-footer"><button className="primary-button" type="submit" disabled={!accounts.some(a=>a.active)}>{income?'Guardar ingreso':'Guardar gasto'}</button></div>
    </form>}</div>
}
export function ExpenseForm({ onBack,onGoToAccounts }: {onBack:()=>void;onGoToAccounts:()=>void}) { return <MovementForm kind="expense" onBack={onBack} onGoToAccounts={onGoToAccounts}/> }
export function IncomeForm({ onBack,onGoToAccounts }: {onBack:()=>void;onGoToAccounts:()=>void}) { return <MovementForm kind="income" onBack={onBack} onGoToAccounts={onGoToAccounts}/> }
