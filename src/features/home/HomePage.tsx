import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { PageHeader } from '../../components/PageHeader'
import { SectionCard } from '../../components/SectionCard'
import type { NavigationItem } from '../../app/navigation'
import { useFinanceData } from '../../hooks/useFinanceData'
import { database } from '../../data/database'
import { monthKey, recurringDatesInMonth } from '../../utils/dates'
import { moveMovementToTrash, saveMovement, skipRecurringOccurrence, updateMovement } from '../../services/finance'
import type { Movement, RecurringItem } from '../../models/entities'

type HomePageProps = { onNavigate: (item: NavigationItem) => void }

function getGreeting() {
  const hour = Number(new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', hour: '2-digit', hourCycle: 'h23',
  }).format(new Date()))

  if (hour < 12) return 'Buenos días'
  if (hour < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' })
    .format(date)
    .replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase('es-ES'))
    .replace(/\bDe\b/g, 'de')
}

function shiftMonth(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function dueLabel(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  const [todayYear, todayMonth, todayDay] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).split('-').map(Number)
  const days = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(todayYear, todayMonth - 1, todayDay)) / 86400000)
  if (days === 0) return 'Vence hoy'
  if (days === 1) return 'Vence mañana'
  if (days > 1) return `Vence en ${days} días`
  if (days === -1) return 'Venció ayer'
  return `Venció hace ${Math.abs(days)} días`
}

function MonthSelector({ value, onChange }: { value: Date; onChange: (date: Date) => void }) {
  return (
    <div className="home-month-row">
      <span className="eyebrow">Resumen de</span>
      <div className="month-selector" role="group" aria-label="Seleccionar mes">
        <button type="button" className="month-arrow" aria-label="Mes anterior" onClick={() => onChange(shiftMonth(value, -1))}>‹</button>
        <span aria-live="polite">{formatMonth(value)}</span>
        <button type="button" className="month-arrow" aria-label="Mes siguiente" onClick={() => onChange(shiftMonth(value, 1))}>›</button>
      </div>
    </div>
  )
}

export function HomePage({ onNavigate }: HomePageProps) {
  const [editingOccurrence, setEditingOccurrence] = useState<{ kind: 'expense' | 'income'; item?: RecurringItem; date: string; movement?: Movement } | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const data = useFinanceData()
  const trashRecords = useLiveQuery(()=>database.trash.toArray(),[],[])
  const wasTrashed = (itemId:string,date:string) => trashRecords?.some(record=>record.movement.recurringItemId===itemId&&(record.movement.recurrenceDate||record.movement.date)===date)??false
  const activeAccounts = new Set(data.accounts.filter(account=>account.active).map(account=>account.id))
  const balance = data.accounts.filter(a=>a.active).reduce((s,a)=>s+a.balance,0)
  const recurringExpenses = data.recurringItems.filter(r=>r.active&&r.kind==='expense'&&(!r.accountId||activeAccounts.has(r.accountId)))
  const now = new Date()
  const realMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const recurringForecasts = recurringExpenses.flatMap(item=>recurringDatesInMonth(item,realMonth)
    .filter(date=>!item.skippedDates?.includes(date)&&!wasTrashed(item.id,date)&&!data.movements.some(m=>m.recurringItemId===item.id&&(m.recurrenceDate||m.date)===date))
    .map(()=>item.amount))
  const pending = data.movements.filter(m=>m.kind==='expense'&&m.status==='pending'&&(!m.accountId||activeAccounts.has(m.accountId))).reduce((s,m)=>s+m.amount,0)+recurringForecasts.reduce((s,amount)=>s+amount,0)
  const selectedMonthKey = monthKey(selectedMonth)
  const current = data.movements.filter(m=>m.date.startsWith(selectedMonthKey))
  const recurrentExpensesForMonth = [
    ...current.filter(m=>m.kind==='expense'&&m.recurringItemId).flatMap(m=>{
      const template=data.recurringItems.find(item=>item.id===m.recurringItemId)
      return [{id:`movement-${m.id}`,concept:m.concept,date:m.date,amount:m.amount,frequency:template?.frequency,status:m.status==='pending'?'Pendiente':'Pagado',template,movement:m}]
    }),
    ...recurringExpenses.flatMap(item=>recurringDatesInMonth(item,selectedMonth).filter(date=>!item.skippedDates?.includes(date)&&!wasTrashed(item.id,date)&&!data.movements.some(m=>m.recurringItemId===item.id&&(m.recurrenceDate||m.date)===date)).map(date=>({id:`forecast-${item.id}-${date}`,concept:item.concept,date,amount:item.amount,frequency:item.frequency,status:'Previsto',template:item,movement:undefined}))),
  ].sort((a,b)=>a.date.localeCompare(b.date))
  const recurringIncomes = data.recurringItems.filter(r=>r.active&&r.kind==='income')
  const incomesForMonth = [
    ...current.filter(m=>m.kind==='income').map(m=>({id:`movement-${m.id}`,concept:m.concept,date:m.date,amount:m.amount,status:m.status==='pending'?'Pendiente':'Recibido',frequency:data.recurringItems.find(item=>item.id===m.recurringItemId)?.frequency})),
    ...recurringIncomes.flatMap(item=>recurringDatesInMonth(item,selectedMonth)
      .filter(date=>!item.skippedDates?.includes(date)&&!wasTrashed(item.id,date)&&!data.movements.some(m=>m.recurringItemId===item.id&&(m.recurrenceDate||m.date)===date))
      .map(date=>({id:`forecast-${item.id}-${date}`,concept:item.concept,date,amount:item.amount,status:'Previsto',frequency:item.frequency}))),
  ].sort((a,b)=>a.date.localeCompare(b.date))
  const latestExpenses = [...data.movements]
    .filter(m=>m.kind==='expense'&&!m.recurringItemId)
    .sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
    .slice(0,3)
  const income = current.filter(m=>m.kind==='income'&&m.status==='received').reduce((s,m)=>s+m.amount,0)
  const expense = current.filter(m=>m.kind==='expense'&&m.status==='paid').reduce((s,m)=>s+m.amount,0)
  const money=(n:number)=>n.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})
  return (
    <div className="page page-home">
      <PageHeader eyebrow="Tu espacio financiero" title={`${getGreeting()} 👋`} detail="Tus finanzas, claras y bajo tu control." />

      <section className="balance-card" aria-label="Saldo total">
        <div className="balance-card-top">
          <span className="balance-label">Saldo total</span>
          <span className="balance-mark" aria-hidden="true">€</span>
        </div>
        <p className="balance-value">{money(balance)} <span>€</span></p>
        <div className="balance-card-bottom">
          <span className="balance-footnote">{data.accounts.length?'Saldo actual de tus cuentas':'Añade una cuenta en Ajustes para empezar'}</span>
          <span className="accounts-count">{data.accounts.filter(a=>a.active).length} cuentas</span>
        </div>
      </section>

      <section className="available-card" aria-label="Disponible real">
        <div className="available-heading">
          <div><p className="eyebrow">Disponible real</p><h2>{money(balance-pending)} <span>€</span></h2></div>
          <span className="available-symbol" aria-hidden="true">◉</span>
        </div>
        <div className="available-breakdown">
          <div><span>Saldo en cuentas</span><span>{money(balance)} €</span></div>
          <div><span>Pagos pendientes y previstos</span><span>− {money(pending)} €</span></div>
        </div>
      </section>

      <MonthSelector value={selectedMonth} onChange={setSelectedMonth} />

      <div className="summary-grid">
        <SectionCard title="Ingresos" icon="↘" value={`${money(income)} €`} />
        <SectionCard title="Gastos" icon="↗" value={`${money(expense)} €`} />
      </div>

      <section className="activity-card" aria-labelledby="upcoming-title">
        <div className="section-heading compact">
          <div><p className="eyebrow">Por fecha de vencimiento</p><h2 id="upcoming-title">Gastos recurrentes</h2></div>
          <button className="text-button" type="button" onClick={() => onNavigate('calendario')}>Ver calendario <span aria-hidden="true">›</span></button>
        </div>
        {recurrentExpensesForMonth.length ? <div className="activity-list">{recurrentExpensesForMonth.map(item=><button className="data-row recurring-home-row" type="button" key={item.id} onClick={()=>setEditingOccurrence({kind:'expense',item:item.template,date:item.movement?.recurrenceDate||item.date,movement:item.movement})}><span>{item.concept}<small>{new Date(`${item.date}T12:00:00`).toLocaleDateString('es-ES')}{item.frequency?` · ${item.frequency==='monthly'?'Cada mes':item.frequency==='weekly'?'Cada semana':item.frequency==='biweekly'?'Cada dos semanas':'Cada año'}`:''}</small></span><span className="recurring-home-amount"><b>{money(item.amount)} €</b><small className={item.status==='Pagado'?'recurring-paid':item.status==='Pendiente'?'recurring-pending':'recurring-forecast'}>{item.status==='Pagado'?<><span aria-hidden="true">✓</span> Pagado</>:dueLabel(item.date)}</small></span><span className="recurring-row-chevron" aria-hidden="true">›</span></button>)}</div> : <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">◷</span>
          <div><p className="empty-title">Sin gastos recurrentes este mes</p><p>Los vencimientos recurrentes de {formatMonth(selectedMonth)} aparecerán aquí.</p></div>
        </div>}
      </section>

      <section className="activity-card" aria-labelledby="income-activity-title">
        <div className="section-heading compact">
          <div><p className="eyebrow">Recibidos y previstos</p><h2 id="income-activity-title">Ingresos</h2></div>
        </div>
        {incomesForMonth.length ? <div className="activity-list">{incomesForMonth.map(item=><button className="data-row recurring-home-row" type="button" key={item.id} onClick={()=>{const movement=item.id.startsWith('movement-')?current.find(m=>m.id===item.id.slice('movement-'.length)):undefined;const template=movement?.recurringItemId?data.recurringItems.find(recurring=>recurring.id===movement.recurringItemId):item.id.startsWith('forecast-')?data.recurringItems.find(recurring=>item.id.startsWith(`forecast-${recurring.id}-`)):undefined;setEditingOccurrence({kind:'income',item:template,date:movement?.recurrenceDate||item.date,movement})}}><span>{item.concept}<small>{new Date(`${item.date}T12:00:00`).toLocaleDateString('es-ES')}{item.frequency?` · ${item.frequency==='monthly'?'Cada mes':item.frequency==='weekly'?'Cada semana':item.frequency==='biweekly'?'Cada dos semanas':'Cada año'}`:''}</small></span><span className="recurring-home-amount"><b>{money(item.amount)} €</b><small className={item.status==='Recibido'?'recurring-paid':item.status==='Pendiente'?'recurring-pending':'recurring-forecast'}>{item.status==='Recibido'?<><span aria-hidden="true">✓</span> Recibido</>:dueLabel(item.date)}</small></span><span className="recurring-row-chevron" aria-hidden="true">›</span></button>)}</div> : <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">↘</span>
          <div><p className="empty-title">Sin ingresos este mes</p><p>Los ingresos de {formatMonth(selectedMonth)} aparecerán aquí.</p></div>
        </div>}
      </section>

      <section className="activity-card" aria-labelledby="latest-expenses-title">
        <div className="section-heading compact">
          <div><p className="eyebrow">Añadidos recientemente</p><h2 id="latest-expenses-title">Gastos</h2></div>
        </div>
        {latestExpenses.length ? <div className="activity-list">{latestExpenses.map(movement=><button className="data-row recurring-home-row" type="button" key={movement.id} onClick={()=>setEditingOccurrence({kind:'expense',date:movement.date,movement})}><span>{movement.concept}<small>{new Date(`${movement.date}T12:00:00`).toLocaleDateString('es-ES')}</small></span><span className="recurring-home-amount"><b>− {money(movement.amount)} €</b></span><span className="recurring-row-chevron" aria-hidden="true">›</span></button>)}</div> : <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">↗</span>
          <div><p className="empty-title">Aún no hay gastos</p><p>Los gastos que añadas aparecerán aquí.</p></div>
        </div>}
      </section>

      <p className="privacy-note"><span aria-hidden="true">◈</span> Tus datos permanecen en este dispositivo</p>
      {editingOccurrence&&<OccurrenceEditor occurrence={editingOccurrence} month={selectedMonth} onClose={()=>setEditingOccurrence(null)}/>}
    </div>
  )
}

function OccurrenceEditor({occurrence,month,onClose}:{occurrence:{kind:'expense'|'income';item?:RecurringItem;date:string;movement?:Movement};month:Date;onClose:()=>void}) {
  const {accounts}=useFinanceData()
  const [status,setStatus]=useState<Movement['status']>(occurrence.movement?.status??'pending')
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault()
    const form=event.currentTarget
    const values=new FormData(form)
    const amount=Number(values.get('amount'))
    const date=String(values.get('date'))
    const status=occurrence.kind==='expense'&&!occurrence.item?'paid':String(values.get('status')) as Movement['status']
    if(!amount||amount<=0||!date)return
    if(occurrence.movement) await updateMovement(occurrence.movement.id,{amount,date,status})
    else if(occurrence.item) await saveMovement({kind:occurrence.kind,concept:occurrence.item.concept,amount,categoryId:occurrence.item.categoryId,accountId:occurrence.item.accountId,date,recurringItemId:occurrence.item.id,recurrenceDate:occurrence.date,status,note:occurrence.item.note})
    onClose()
  }
  const existing=occurrence.movement
  const recurringItem=occurrence.item
  const isRecurring=Boolean(recurringItem)
  const isIncome=occurrence.kind==='income'
  const title=existing?.concept||occurrence.item?.concept||(isIncome?'Ingreso':'Gasto recurrente')
  const monthKeyValue=monthKey(month)
  const lastDay=new Date(month.getFullYear(),month.getMonth()+1,0).getDate()
  const monthEnd=`${monthKeyValue}-${String(lastDay).padStart(2,'0')}`
  const deleteIncome=async()=>{
    if(isIncome&&existing&&!recurringItem){
      if(!window.confirm(`¿Borrar el ingreso «${existing.concept}»? Se enviará a la papelera.`))return
      await moveMovementToTrash(existing.id)
    }else if(isIncome&&recurringItem){
      if(!window.confirm(`¿Borrar solo el ingreso de ${new Date(`${occurrence.date}T12:00:00`).toLocaleDateString('es-ES')}? El siguiente ingreso recurrente seguirá programado.`))return
      await skipRecurringOccurrence(recurringItem.id,occurrence.date)
    }else if(occurrence.kind==='expense'&&recurringItem){
      if(!window.confirm(`¿Eliminar solo el gasto de ${new Date(`${occurrence.date}T12:00:00`).toLocaleDateString('es-ES')}? El siguiente vencimiento seguirá programado.`))return
      await skipRecurringOccurrence(recurringItem.id,occurrence.date)
    }else if(occurrence.kind==='expense'&&existing){
      if(!window.confirm(`¿Borrar el gasto «${existing.concept}»? Se enviará a la papelera.`))return
      await moveMovementToTrash(existing.id)
    }else return
    onClose()
  }
  return <div className="quick-add-overlay" role="presentation"><button className="quick-add-backdrop" type="button" aria-label="Cerrar" onClick={onClose}/><section className="quick-add-sheet occurrence-editor" role="dialog" aria-modal="true" aria-labelledby="occurrence-title"><div className="sheet-grabber" aria-hidden="true"/><header className="quick-add-header"><div><p className="eyebrow">{isRecurring?'Solo para este mes':'Movimiento'}</p><h2 id="occurrence-title">{title}</h2><p>{isRecurring?'El cambio no modifica los siguientes vencimientos.':isIncome?'Puedes modificar el importe, la fecha o el estado.':'Puedes modificar el importe y la fecha.'}</p></div><button className="sheet-close" type="button" aria-label="Cerrar" onClick={onClose}>×</button></header><form className="occurrence-form" onSubmit={submit}><label className="form-field"><span>Importe</span><span className="amount-input-wrap"><input name="amount" type="number" min="0.01" step="0.01" required defaultValue={existing?.amount??occurrence.item?.amount}/><span>€</span></span></label><label className="form-field"><span>Fecha exacta</span><input name="date" type="date" min={isRecurring?`${monthKeyValue}-01`:undefined} max={isRecurring?monthEnd:undefined} required defaultValue={existing?.date??occurrence.date}/></label>{(isIncome||isRecurring)&&<fieldset className="status-field"><legend>Estado</legend><div className="status-options"><label className={`status-option${status==='pending'?' is-selected':''}`}><input type="radio" name="status" value="pending" checked={status==='pending'} onChange={()=>setStatus('pending')}/><span className="status-dot"/>Pendiente</label><label className={`status-option${status===(isIncome?'received':'paid')?' is-selected':''}`}><input type="radio" name="status" value={isIncome?'received':'paid'} checked={status===(isIncome?'received':'paid')} onChange={()=>setStatus(isIncome?'received':'paid')}/><span className="status-dot"/>{isIncome?'Recibido':'Pagado'}</label></div></fieldset>}<button className="primary-button" type="submit" disabled={!existing&&(!occurrence.item?.accountId||!accounts.some(account=>account.id===occurrence.item?.accountId&&account.active))}>{existing?'Guardar cambios':'Guardar este vencimiento'}</button>{!existing&&occurrence.item&&!accounts.some(account=>account.id===occurrence.item?.accountId&&account.active)&&<p className="field-hint">Asigna una cuenta al movimiento recurrente antes de guardarlo.</p>}</form>{(occurrence.kind==='expense'&&recurringItem||isIncome&&(existing&&!recurringItem||recurringItem)||occurrence.kind==='expense'&&existing&&!recurringItem)&&<button className="occurrence-delete-button" type="button" onClick={deleteIncome}>{isIncome?(recurringItem?'Eliminar solo este mes':'Borrar ingreso'):(recurringItem?'Eliminar solo este mes':'Borrar gasto')}</button>}</section></div>
}
