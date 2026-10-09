import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { PageHeader } from '../../components/PageHeader'
import { database } from '../../data/database'
import { useFinanceData } from '../../hooks/useFinanceData'
import { createEncryptedBackup, readEncryptedBackup, restoreBackup } from '../../services/backup'
import { addAccount, addCategory, attachDocumentsToMovement, deleteRecurringFromDate, deleteUserCategory, isBuiltInCategory, moveMovementToTrash, restoreMovementFromTrash, skipRecurringOccurrence, updateMovement, updateRecurring } from '../../services/finance'
import { disableNotifications, enableNotifications, notificationsAvailable, notificationsEnabled, sendTestNotification } from '../../services/notifications'
import { hasBiometric, hasPin, platformAuthenticatorAvailable, registerBiometric, removeBiometric, removePin, setPin, verifyPin } from '../../services/security'
import { dateKey, monthKey, monthLabel, recurringDatesInMonth } from '../../utils/dates'
import type { NavigationItem } from '../../app/navigation'
import type { Account, Profile, RecurringItem } from '../../models/entities'

const euro=(n:number)=>n.toLocaleString('es-ES',{style:'currency',currency:'EUR'})
export function FinancePage({section,onLockNow,openAccountsOnLoad=false,onAccountsClose,onStartTransfer}:{section:Exclude<NavigationItem,'inicio'>;onLockNow:()=>void;openAccountsOnLoad?:boolean;onAccountsClose?:()=>void;onStartTransfer?:()=>void}) {
 const d=useFinanceData(); const [filter,setFilter]=useState('all'); const [search,setSearch]=useState(''); const [categoryFilter,setCategoryFilter]=useState('all'); const [accountFilter,setAccountFilter]=useState('all'); const [fromDate,setFromDate]=useState(''); const [toDate,setToDate]=useState(''); const [message,setMessage]=useState('');
 const [statsDate,setStatsDate]=useState(()=>{const n=new Date();return new Date(n.getFullYear(),n.getMonth(),1)})
 const [settingsPage,setSettingsPage]=useState<SettingsPage>(()=>openAccountsOnLoad?'accounts':null)
 const [editingRecurring,setEditingRecurring]=useState<RecurringItem|null>(null)
 const trash=useLiveQuery(()=>database.trash.orderBy('deletedAt').reverse().toArray(),[],[])
 const savedProfile=useLiveQuery(()=>database.profiles.get('local'),[],undefined)
 const [notificationState,setNotificationState]=useState(()=>notificationsAvailable()?Notification.permission:'unsupported')
 const [remindersActive,setRemindersActive]=useState(()=>notificationsEnabled())
 const [pinEnabled,setPinEnabled]=useState(()=>hasPin())
 const [pinMessage,setPinMessage]=useState('')
 const [biometricAvailable,setBiometricAvailable]=useState(false)
 const [biometricEnabled,setBiometricEnabled]=useState(()=>hasBiometric())
 useEffect(()=>{void platformAuthenticatorAvailable().then(setBiometricAvailable)},[])
 const title={calendario:'Calendario',gastos:'Movimientos',estadisticas:'Estadísticas',ajustes:'Ajustes'}[section]
 const movements=d.movements.filter(m=>m.kind!=='transfer');
  const month=monthKey(); const statsMonth=monthKey(statsDate); const inMonth=movements.filter(m=>m.date.startsWith(statsMonth));
 const closeAccounts=()=>{setSettingsPage(null);onAccountsClose?.()}
 return <div className="page">{section==='ajustes'&&settingsPage&&settingsPage!=='profile'&&settingsPage!=='accounts'?<header className="settings-subheader"><button type="button" className="back-button" onClick={()=>{setMessage('');setSettingsPage(settingsPage==='recurring-expense'||settingsPage==='recurring-income'?'recurring':null)}}><span aria-hidden="true">‹</span> Ajustes</button><h1>{settingsPageTitle(settingsPage)}</h1></header>:<PageHeader eyebrow="Tu espacio financiero" title={title} detail={section==='ajustes'?'Personaliza tus cuentas y tu espacio.':section==='calendario'?'Consulta tus movimientos por día y mes.':section==='estadisticas'?'Un resumen claro de este mes.':'Consulta y filtra tus movimientos.'}/>}
 {section==='ajustes'&&<>
   {(!settingsPage||settingsPage==='profile'||settingsPage==='accounts')&&<SettingsMenu data={d} onOpen={page=>{setMessage('');setSettingsPage(page)}}/>}
  {settingsPage==='profile'&&<ProfileEditor profile={savedProfile} onClose={()=>setSettingsPage(null)}/>}
  {settingsPage==='accounts'&&<AccountsEditor accounts={d.accounts} onClose={closeAccounts} onTransfer={onStartTransfer}/>}
  {settingsPage==='family'&&<section className="settings-coming"><span>♣</span><b>Próximamente</b><p>En futuras versiones podrás compartir tus finanzas y gestionar gastos comunes.</p></section>}
{settingsPage==='security'&&  <section className="activity-card"><h2>Bloqueo de la aplicación</h2><p className="empty-copy">Añade una pantalla de bloqueo para que otras personas no abran la app en este dispositivo.</p><form className="inline-form pin-form" onSubmit={async e=>{e.preventDefault();setPinMessage('');const f=new FormData(e.currentTarget);const current=String(f.get('currentPin')||'');const next=String(f.get('newPin')||'');const repeat=String(f.get('repeatPin')||'');if(pinEnabled&&!await verifyPin(current)){setPinMessage('El PIN actual no es correcto.');return}if(!/^\d{6,12}$/.test(next)){setPinMessage('Usa entre 6 y 12 dígitos.');return}if(next!==repeat){setPinMessage('Los dos PIN no coinciden.');return}try{await setPin(next);setPinEnabled(true);setPinMessage('PIN guardado en este dispositivo.');e.currentTarget.reset()}catch{setPinMessage('No se pudo guardar el PIN en este navegador.')}}}>{pinEnabled&&<input name="currentPin" type="password" inputMode="numeric" pattern="[0-9]{6,12}" minLength={6} maxLength={12} required placeholder="PIN actual" autoComplete="current-password"/>}<input name="newPin" type="password" inputMode="numeric" pattern="[0-9]{6,12}" minLength={6} maxLength={12} required placeholder={pinEnabled?'Nuevo PIN':'Crea un PIN de 6 a 12 dígitos'} autoComplete="new-password"/><input name="repeatPin" type="password" inputMode="numeric" pattern="[0-9]{6,12}" minLength={6} maxLength={12} required placeholder="Repite el PIN" autoComplete="new-password"/><button className="primary-button">{pinEnabled?'Cambiar PIN':'Activar bloqueo'}</button></form>{pinEnabled&&<><button className="text-button" onClick={onLockNow}>Bloquear ahora</button><button className="text-button" onClick={async()=>{const current=window.prompt('Introduce tu PIN actual para desactivar el bloqueo.');if(!current)return;if(!await verifyPin(current)){setPinMessage('El PIN actual no es correcto.');return}removeBiometric();setBiometricEnabled(false);removePin();setPinEnabled(false);setPinMessage('Bloqueo desactivado.')}}>Desactivar bloqueo</button>{biometricAvailable&&!biometricEnabled&&<button className="primary-button" onClick={async()=>{try{await registerBiometric();setBiometricEnabled(true);setPinMessage('Autenticación del dispositivo activada.')}catch(error){setPinMessage(error instanceof Error?error.message:'No se pudo configurar la biometría.')}}}>Configurar Face ID, huella o PIN del dispositivo</button>}{biometricEnabled&&<button className="text-button" onClick={()=>{removeBiometric();setBiometricEnabled(false);setPinMessage('Acceso biométrico desactivado.')}}>Desactivar Face ID o huella</button>}</>}<p className="field-hint">El PIN protege la pantalla de acceso. Los datos de IndexedDB no quedan cifrados por este bloqueo; la copia de seguridad sí está cifrada.</p>{pinMessage&&<p className="field-hint" role="status">{pinMessage}</p>}</section>}
{settingsPage==='notifications'&&  <section className="activity-card"><h2>Avisos</h2><p className="empty-copy">Recibe un aviso en la fecha configurada para cada movimiento recurrente.</p>{notificationState==='unsupported'?<p className="field-hint">Este navegador no ofrece notificaciones.</p>:notificationState==='denied'?<p className="field-hint">El permiso está bloqueado en el navegador. Cámbialo desde los ajustes del sitio.</p>:remindersActive?<><p className="field-hint">Avisos activados en este dispositivo.</p><button className="primary-button" onClick={async()=>setMessage(await sendTestNotification()?'Notificación de prueba enviada.':'No se pudo enviar el aviso.')}>Enviar aviso de prueba</button><button className="text-button" onClick={()=>{disableNotifications();setRemindersActive(false);setMessage('Avisos desactivados.')}}>Desactivar notificaciones</button></>:<button className="primary-button" onClick={async()=>{const permission=await enableNotifications();setNotificationState(permission);if(permission==='granted'){setRemindersActive(true);setMessage('Avisos activados.')}else if(permission==='unsupported')setMessage('Este navegador no ofrece notificaciones.');else setMessage('No se concedió el permiso de notificaciones.')}}>{notificationState==='granted'?'Activar recordatorios':'Permitir notificaciones'}</button>}<p className="field-hint">El navegador puede limitar los avisos cuando cierres la app. Para notificaciones fiables en iPhone, instala la PWA y mantén permisos activos.</p>{message&&<p className="field-hint" role="status">{message}</p>}</section>}
{settingsPage==='categories'&&  <><section className="activity-card"><p className="empty-copy">Añade y gestiona aquí tus categorías personalizadas.</p><form className="inline-form" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);const name=String(f.get('name')).trim();if(name){await addCategory(name,String(f.get('kind')) as 'expense'|'income');form.reset();setMessage('Categoría añadida.')}}}><input name="name" required placeholder="Nueva categoría"/><select name="kind"><option value="expense">Gasto</option><option value="income">Ingreso</option></select><button className="primary-button">Añadir</button></form>{d.categories.filter(c=>!isBuiltInCategory(c)).map(c=><div className="data-row category-row" key={c.id}><span>{c.name}<small>{c.kind==='expense'?'Gasto':'Ingreso'}</small></span><button className="category-delete" onClick={async()=>{const target=c.kind==='expense'?'Otros':'Otros ingresos';if(!window.confirm(`Al eliminar «${c.name}», sus movimientos y previsiones pasarán a «${target}». ¿Continuar?`))return;try{await deleteUserCategory(c.id);setMessage(`Categoría eliminada. Sus movimientos se trasladaron a ${target}.`)}catch(error){setMessage(error instanceof Error?error.message:'No se pudo eliminar la categoría.')}}}>Eliminar</button></div>)}{!d.categories.some(c=>!isBuiltInCategory(c))&&<p className="empty-copy">Aún no has añadido categorías personalizadas.</p>}{message&&<p className="field-hint" role="status">{message}</p>}</section></>}
{settingsPage==='budgets'&&  <section className="activity-card"><div className="section-heading"><h2>Presupuestos del mes</h2></div><form className="inline-form" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const categoryId=String(f.get('categoryId'));const amount=Number(f.get('amount'));if(categoryId&&amount>0)await database.budgets.add({id:crypto.randomUUID(),categoryId,amount,month:monthKey(),createdAt:new Date().toISOString()});e.currentTarget.reset()}}><select name="categoryId" required><option value="">Categoría</option>{d.categories.filter(c=>c.kind==='expense'&&c.active).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><input name="amount" required type="number" min="1" step="0.01" placeholder="Límite €"/><button className="primary-button">Guardar</button></form>{d.budgets.filter(b=>b.month===month).map(b=>{const spent=d.movements.filter(m=>m.kind==='expense'&&m.status==='paid'&&m.date.startsWith(month)&&m.categoryId===b.categoryId).reduce((s,m)=>s+m.amount,0);const ratio=spent/b.amount;return <div className="budget-card" key={b.id}><div><b>{d.categories.find(c=>c.id===b.categoryId)?.name}</b><span>{euro(spent)} / {euro(b.amount)} · {Math.round(ratio*100)}%</span></div><div className="budget-track"><i className={ratio>=1?'over-budget':''} style={{width:`${Math.min(100,ratio*100)}%`}}/></div><button onClick={()=>database.budgets.delete(b.id)}>Eliminar</button></div>})}</section>}
{settingsPage==='recurring'&&<section className="settings-choice-list">{(['expense','income'] as const).map(kind=><button className="settings-choice" type="button" key={kind} onClick={()=>setSettingsPage(kind==='expense'?'recurring-expense':'recurring-income')}><span className={`settings-icon ${kind==='expense'?'settings-icon-expense':'settings-icon-income'}`}>{kind==='expense'?'↓':'↑'}</span><span><b>{kind==='expense'?'Gastos recurrentes':'Ingresos recurrentes'}</b><small>{d.recurringItems.filter(r=>r.active&&r.kind===kind).length} movimientos</small></span><i>›</i></button>)}</section>}
  {(settingsPage==='recurring-expense'||settingsPage==='recurring-income')&&<section className="activity-card recurring-settings-list">{d.recurringItems.filter(r=>r.active&&r.kind===(settingsPage==='recurring-expense'?'expense':'income')).map(r=><button className="data-row recurring-settings-row" type="button" key={r.id} onClick={()=>setEditingRecurring(r)}><span>{r.concept}<small>{r.frequency==='weekly'?'Cada semana':r.frequency==='biweekly'?'Cada dos semanas':r.frequency==='monthly'?'Cada mes':'Cada año'} · próximo {new Date(`${r.nextDate}T12:00:00`).toLocaleDateString('es-ES')}</small></span><b>{euro(r.amount)}</b><i aria-hidden="true">›</i></button>)}{!d.recurringItems.some(r=>r.active&&r.kind===(settingsPage==='recurring-expense'?'expense':'income'))&&<p className="empty-copy">Añade un movimiento recurrente desde el botón + de Inicio.</p>}</section>}
  {editingRecurring&&<RecurringEditor item={editingRecurring} data={d} onClose={()=>setEditingRecurring(null)}/>}
{settingsPage==='trash'&&  <section className="activity-card"><h2>Movimientos eliminados</h2>{trash?.map(record=><div className="data-row" key={record.id}><span>{record.movement.concept}<small>Eliminado {new Date(record.deletedAt).toLocaleDateString('es-ES')}</small></span><button onClick={()=>restoreMovementFromTrash(record.id)}>Recuperar</button><button onClick={()=>{if(confirm('¿Eliminar definitivamente este movimiento?'))database.trash.delete(record.id)}}>Borrar</button></div>)}{trash?.length===0&&<p className="empty-copy">Los movimientos que envíes a la papelera aparecerán aquí.</p>}</section>}
{settingsPage==='backup'&&<BackupSettings/>}
{settingsPage==='about'&&  <section className="activity-card"><h2>Datos y privacidad</h2><p className="empty-copy">Los datos se guardan en este dispositivo. La app no crea cuentas ni envía datos a servidores.</p><button className="text-button" onClick={async()=>{if(window.confirm('¿Borrar permanentemente todos los datos de esta app?')){await database.delete();location.reload()}}}>Borrar todos mis datos</button></section>}
 </>}
 {section==='gastos'&&<><label className="search-field"><span className="sr-only">Buscar movimiento</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar movimientos"/></label><div className="filter-row">{[['all','Todos'],['paid','Pagados'],['pending','Pendientes']].map(([id,label])=><button className={filter===id?'selected':''} key={id} onClick={()=>setFilter(id)}>{label}</button>)}</div><div className="filter-controls"><label><span>Categoría</span><select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option value="all">Todas</option>{d.categories.filter(c=>c.active).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label><span>Cuenta</span><select value={accountFilter} onChange={e=>setAccountFilter(e.target.value)}><option value="all">Todas</option>{d.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label><span>Desde</span><input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}/></label><label><span>Hasta</span><input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}/></label></div>{movements.filter(m=>(filter==='all'||m.status===filter)&&(categoryFilter==='all'||m.categoryId===categoryFilter)&&(accountFilter==='all'||m.accountId===accountFilter)&&(!fromDate||m.date>=fromDate)&&(!toDate||m.date<=toDate)&&`${m.concept} ${d.categories.find(c=>c.id===m.categoryId)?.name||''} ${d.accounts.find(a=>a.id===m.accountId)?.name||''}`.toLocaleLowerCase('es-ES').includes(search.toLocaleLowerCase('es-ES'))).map(m=><MovementRow key={m.id} m={m} data={d}/>)}</>}
 {section==='calendario'&&<CalendarView data={d}/>}
 {section==='estadisticas'&&<><div className="home-month-row"><span className="eyebrow">Resumen de</span><div className="month-selector"><button type="button" className="month-arrow" aria-label="Mes anterior" onClick={()=>setStatsDate(d=>new Date(d.getFullYear(),d.getMonth()-1,1))}>‹</button><span>{monthLabel(statsDate)}</span><button type="button" className="month-arrow" aria-label="Mes siguiente" onClick={()=>setStatsDate(d=>new Date(d.getFullYear(),d.getMonth()+1,1))}>›</button></div></div><section className="activity-card"><h2>Resumen mensual</h2><div className="data-row"><span>Ingresos recibidos</span><b>{euro(inMonth.filter(m=>m.kind==='income'&&m.status==='received').reduce((s,m)=>s+m.amount,0))}</b></div><div className="data-row"><span>Gastos pagados</span><b>{euro(inMonth.filter(m=>m.kind==='expense'&&m.status==='paid').reduce((s,m)=>s+m.amount,0))}</b></div></section><section className="activity-card"><h2>Gastos por categoría</h2>{d.categories.filter(c=>c.kind==='expense'&&c.active).map(c=>{const n=inMonth.filter(m=>m.categoryId===c.id&&m.status==='paid').reduce((s,m)=>s+m.amount,0);return n>0&&<div className="chart-row" key={c.id}><div><span>{c.name}</span><b>{euro(n)}</b></div><div className="budget-track"><i style={{width:`${Math.min(100,n/Math.max(...d.categories.map(cat=>inMonth.filter(m=>m.categoryId===cat.id&&m.status==='paid').reduce((s,m)=>s+m.amount,0)),1)*100)}%`}}/></div></div>})}{!inMonth.some(m=>m.kind==='expense'&&m.status==='paid')&&<p className="empty-copy">Los gastos pagados se desglosarán aquí.</p>}</section></>}
 </div>
}
type SettingsPage='profile'|'accounts'|'categories'|'recurring'|'recurring-expense'|'recurring-income'|'budgets'|'notifications'|'backup'|'trash'|'security'|'family'|'about'|null
function settingsPageTitle(page:SettingsPage) { return ({profile:'Mi perfil',accounts:'Cuentas',categories:'Categorías',recurring:'Movimientos recurrentes','recurring-expense':'Gastos recurrentes','recurring-income':'Ingresos recurrentes',budgets:'Presupuestos',notifications:'Notificaciones',backup:'Copias de seguridad',trash:'Papelera',security:'Seguridad',family:'Familia',about:'Acerca de'} as const)[page||'profile'] }
function SettingsMenu({data,onOpen}:{data:ReturnType<typeof useFinanceData>;onOpen:(page:SettingsPage)=>void}) {
 const groups=[
  [{page:'profile' as const,icon:'●',title:'Mi perfil',detail:'Nombre, moneda y zona horaria'}, {page:'accounts' as const,icon:'▤',title:'Cuentas',detail:'Gestiona tus cuentas'}, {page:'categories' as const,icon:'◆',title:'Categorías',detail:'Organiza gastos e ingresos'}, {page:'recurring' as const,icon:'↻',title:'Movimientos recurrentes',detail:'Gastos e ingresos automáticos'}, {page:'budgets' as const,icon:'◉',title:'Presupuestos',detail:'Límites y alertas'}],
  [{page:'notifications' as const,icon:'♟',title:'Notificaciones',detail:'Configura tus notificaciones'}, {page:'backup' as const,icon:'☁',title:'Copias de seguridad',detail:'Guarda y restaura tus datos'}, {page:'trash' as const,icon:'▣',title:'Papelera',detail:'Elementos eliminados'}],
  [{page:'security' as const,icon:'▣',title:'Seguridad',detail:'Bloqueo de la aplicación'}, {page:'family' as const,icon:'♣',title:'Familia',detail:'Próximamente'}, {page:'about' as const,icon:'ⓘ',title:'Acerca de',detail:'Versión, ayuda y contacto'}],
 ];
 const count=(page:SettingsPage)=>page==='accounts'?data.accounts.filter(a=>a.active).length:page==='categories'?data.categories.filter(c=>!isBuiltInCategory(c)).length:page==='recurring'?data.recurringItems.filter(r=>r.active).length:page==='budgets'?data.budgets.length:null;
 return <div className="settings-menu">{groups.map((group,index)=><section className="settings-menu-group" key={index}>{group.map(item=><button className="settings-row" type="button" key={item.page} onClick={()=>onOpen(item.page)}><span className={`settings-icon settings-icon-${item.page}`}>{item.icon}</span><span className="settings-row-copy"><b>{item.title}</b><small>{item.detail}</small></span>{count(item.page)!==null&&<small className="settings-count">{count(item.page)}</small>}<span className="settings-chevron">›</span></button>)}</section>)}</div>
}

function CalendarView({data}:{data:ReturnType<typeof useFinanceData>}) {
 const today=dateKey();
 const trashRecords=useLiveQuery(()=>database.trash.toArray(),[],[])
 const [month,setMonth]=useState(()=>{const n=new Date();return new Date(n.getFullYear(),n.getMonth(),1)});
 const [selected,setSelected]=useState(today);
 const [showDay,setShowDay]=useState(false);
 const monthId=monthKey(month);
 const days=useMemo(()=>{
  const first=new Date(month.getFullYear(),month.getMonth(),1);
  const offset=(first.getDay()+6)%7;
  const count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  const cells=Math.ceil((offset+count)/7)*7;
  return Array.from({length:cells},(_,i)=>new Date(month.getFullYear(),month.getMonth(),i-offset+1));
 },[month]);
 const monthMovements=data.movements.filter(m=>m.date.startsWith(monthId));
 const recurrences=data.recurringItems.filter(r=>r.active).flatMap(item=>recurringDatesInMonth(item,month).filter(date=>!item.skippedDates?.includes(date)&&!trashRecords?.some(record=>record.movement.recurringItemId===item.id&&(record.movement.recurrenceDate||record.movement.date)===date)).map(date=>({item,date}))).filter(({item,date})=>!data.movements.some(m=>m.recurringItemId===item.id&&(m.recurrenceDate||m.date)===date));
 const income=monthMovements.filter(m=>m.kind==='income').reduce((s,m)=>s+m.amount,0)+recurrences.filter(r=>r.item.kind==='income').reduce((s,r)=>s+r.item.amount,0);
 const expenses=monthMovements.filter(m=>m.kind==='expense').reduce((s,m)=>s+m.amount,0)+recurrences.filter(r=>r.item.kind==='expense').reduce((s,r)=>s+r.item.amount,0);
 const pending=monthMovements.filter(m=>m.kind==='expense'&&m.status==='pending').reduce((s,m)=>s+m.amount,0)+recurrences.filter(r=>r.item.kind==='expense').reduce((s,r)=>s+r.item.amount,0);
 const monthBudgets=data.budgets.filter(b=>b.month===monthId);
 const monthEndDate=new Date(month.getFullYear(),month.getMonth()+1,0);
 const daysToMonthEnd=Math.ceil((Date.UTC(monthEndDate.getFullYear(),monthEndDate.getMonth(),monthEndDate.getDate())-Date.UTC(new Date().getFullYear(),new Date().getMonth(),new Date().getDate()))/86400000);
 const selectedDate=new Date(`${selected}T12:00:00`);
 const dayMovements=data.movements.filter(m=>m.date===selected).sort((a,b)=>a.concept.localeCompare(b.concept,'es'));
 const dayRecurrences=recurrences.filter(r=>r.date===selected).map(r=>r.item);
 const groups=[
  {title:'Ingresos',kind:'income' as const,items:dayMovements.filter(m=>m.kind==='income'&&m.status!=='pending'),tone:'income'},
  {title:'Gastos',kind:'expense' as const,items:dayMovements.filter(m=>m.kind==='expense'&&m.status!=='pending'),tone:'expense'},
  {title:'Pendientes',kind:'pending' as const,items:dayMovements.filter(m=>m.status==='pending'),tone:'pending'},
  {title:'Transferencias',kind:'transfer' as const,items:dayMovements.filter(m=>m.kind==='transfer'),tone:'transfer'},
 ];
 const summary=[['Ingresos previstos',income,'↑','income'],['Gastos previstos',expenses,'↓','expense'],['Pendiente por pagar',pending,'◷','pending'],['Balance previsto',income-expenses,'▥','balance']] as const;
 function moveMonth(amount:number){setMonth(current=>new Date(current.getFullYear(),current.getMonth()+amount,1))}
 function goToday(){const now=new Date();setMonth(new Date(now.getFullYear(),now.getMonth(),1));setSelected(today);setShowDay(false)}
 function markers(date:string){const records=data.movements.filter(m=>m.date===date);const types:string[]=[];if(records.some(m=>m.kind==='income'))types.push('income');if(records.some(m=>m.kind==='expense'&&m.status!=='pending'))types.push('expense');if(records.some(m=>m.kind==='expense'&&m.status==='pending')||records.some(m=>m.status==='pending'&&m.kind==='income'))types.push('pending');if(recurrences.some(r=>r.date===date))types.push('forecast');return [...new Set(types)]}
 if(showDay)return <div className="calendar-day-view"><button type="button" className="calendar-back" onClick={()=>setShowDay(false)}>‹ <span>{monthLabel(month)}</span></button><h2>{selectedDate.toLocaleDateString('es-ES',{day:'numeric',month:'long'}).replace(/^\p{L}/u,c=>c.toLocaleUpperCase('es-ES'))}</h2><p className="calendar-day-subtitle">{selectedDate.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).replace(/^\p{L}/u,c=>c.toLocaleUpperCase('es-ES'))}</p>{groups.filter(g=>g.items.length).map(group=><section className={`calendar-day-group ${group.tone}`} key={group.kind}><header><b>{group.title} ({group.items.length})</b><b>{euro(group.items.reduce((sum,m)=>sum+m.amount,0))}</b></header>{group.items.map(m=><MovementRow key={m.id} m={m} data={data}/>)}</section>)}{dayRecurrences.length>0&&<section className="calendar-day-group forecast"><header><b>Previstos ({dayRecurrences.length})</b><b>{euro(dayRecurrences.reduce((sum,r)=>sum+r.amount,0))}</b></header>{dayRecurrences.map(r=><article className="calendar-planned-row" key={r.id}><span className="calendar-planned-icon">↻</span><span><b>{r.concept}</b><small>{r.kind==='expense'?'Gasto recurrente':'Ingreso recurrente'} · {r.frequency}</small></span><b>{euro(r.amount)}</b></article>)}</section>}{!dayMovements.length&&!dayRecurrences.length&&<p className="empty-copy calendar-empty-day">No hay movimientos para este día.</p>}</div>;
 return <div className="calendar-view"><div className="calendar-toolbar"><div className="month-selector"><button type="button" className="month-arrow" aria-label="Mes anterior" onClick={()=>moveMonth(-1)}>‹</button><span>{monthLabel(month)}</span><button type="button" className="month-arrow" aria-label="Mes siguiente" onClick={()=>moveMonth(1)}>›</button></div><button type="button" className="calendar-today" onClick={goToday}>Hoy</button></div><div className="calendar-card"><div className="calendar-weekdays">{'LMXJVSD'.split('').map((day,i)=><span key={i}>{day}</span>)}</div><div className="calendar-grid">{days.map(day=>{const key=dateKey(day);const outside=day.getMonth()!==month.getMonth();const dayMarkers=markers(key);return <button type="button" key={key} className={`calendar-cell${outside?' outside':''}${key===selected?' selected':''}${key===today?' today':''}`} onClick={()=>{setSelected(key);if(outside)setMonth(new Date(day.getFullYear(),day.getMonth(),1));setShowDay(true)}} aria-label={`${day.toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}${dayMarkers.length?`, ${dayMarkers.length} tipos de movimiento`:''}`}><span>{day.getDate()}</span><i className="calendar-dots">{dayMarkers.map(type=><i key={type} className={`calendar-dot ${type}`}/>)}</i></button>})}</div></div><div className="calendar-legend">{[['income','Ingreso'],['expense','Gasto'],['pending','Pendiente'],['forecast','Previsto']].map(([type,label])=><span key={type}><i className={`calendar-dot ${type}`}/>{label}</span>)}</div><section className="calendar-summary"><h2>Resumen de {monthLabel(month)}</h2><div className="calendar-summary-grid">{summary.map(([label,value,icon,tone])=><article className={`calendar-summary-tile ${tone}`} key={label}><span className="calendar-summary-icon">{icon}</span><span className="calendar-summary-copy"><small>{label}</small><b>{value>0&&tone==='balance'?'+':''}{euro(value)}</b></span></article>)}</div>{recurrences.length>0&&<p className="calendar-recurrence-note">{recurrences.length} movimiento{recurrences.length===1?'':'s'} recurrente{recurrences.length===1?'':'s'} previsto{recurrences.length===1?'':'s'} este mes</p>}</section><section className="calendar-budgets" aria-labelledby="calendar-budgets-title"><div className="calendar-budgets-heading"><div><p className="eyebrow">Control del mes</p><h2 id="calendar-budgets-title">Presupuestos</h2></div></div><p className="calendar-countdown">{daysToMonthEnd < 0 ? "0 días" : `${daysToMonthEnd} días`}</p>{monthBudgets.length?monthBudgets.map(budget=>{const category=data.categories.find(item=>item.id===budget.categoryId);const spent=monthMovements.filter(m=>m.kind==='expense'&&m.status==='paid'&&m.categoryId===budget.categoryId).reduce((sum,movement)=>sum+movement.amount,0);const ratio=budget.amount>0?spent/budget.amount:0;return <article className="calendar-budget-row" key={budget.id}><div className="calendar-budget-copy"><b>{category?.name||'Categoría'}</b><span>{euro(spent)} de {euro(budget.amount)}{ratio>=1?' · Límite superado':''}</span></div><div className={`calendar-budget-track${ratio>=1?' over':''}`} role="progressbar" aria-label={`Presupuesto de ${category?.name||'categoría'}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,Math.round(ratio*100))}><i style={{width:`${Math.min(100,ratio*100)}%`}}/></div></article>}) : <p className="calendar-budgets-empty">No hay presupuestos para {monthLabel(month)}. Puedes configurarlos desde Ajustes.</p>}</section></div>
}

function MovementRow({m,data}:{m:import('../../models/entities').Movement;data:ReturnType<typeof useFinanceData>}) {
 const open=false
 const [editing,setEditing]=useState(false)
 const docs=useLiveQuery(()=>database.documents.where('movementId').equals(m.id).toArray(),[m.id],[])
 const amount=(m.kind==='expense'?'−':m.kind==='income'?'+':'⇄')+euro(m.amount)
 async function save(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const f=new FormData(event.currentTarget);const amount=Number(f.get('amount'));const concept=String(f.get('concept')).trim();if(!amount||!concept)return;if(m.kind==='transfer'){const from=String(f.get('fromAccount'));const to=String(f.get('toAccount'));if(!from||!to||from===to)return;await updateMovement(m.id,{concept,amount,accountId:from,toAccountId:to,date:String(f.get('date')),status:'paid',note:String(f.get('note')||'')})}else await updateMovement(m.id,{concept,amount,categoryId:String(f.get('categoryId'))||undefined,accountId:String(f.get('accountId'))||undefined,date:String(f.get('date')),status:String(f.get('status')) as 'paid'|'pending'|'received',note:String(f.get('note')||'')});setEditing(false)}
 return <><article className="movement-row"><button className="movement-main" aria-haspopup="dialog" onClick={()=>setEditing(true)}><span className="movement-icon">{m.kind==='expense'?'↗':m.kind==='income'?'↙':'⇄'}</span><span className="movement-copy"><b>{m.concept}</b><small>{data.categories.find(c=>c.id===m.categoryId)?.name||(m.kind==='transfer'?'Transferencia':'Sin categoría')} · {data.accounts.find(a=>a.id===m.accountId)?.name}</small></span><span className={m.kind==='expense'?'negative':'positive'}>{amount}<small>{m.status==='pending'?'Pendiente':'Realizado'}</small></span></button>
 {open&&<div className="movement-actions">{editing&&<form className="inline-form edit-movement-form" onSubmit={save}><input name="concept" required defaultValue={m.concept} aria-label="Concepto"/><input name="amount" type="number" required min="0.01" step="0.01" defaultValue={m.amount} aria-label="Importe"/>{m.kind==='transfer'?<><select name="fromAccount" defaultValue={m.accountId||''} aria-label="Cuenta de origen">{data.accounts.filter(a=>a.active).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><select name="toAccount" defaultValue={m.toAccountId||''} aria-label="Cuenta de destino">{data.accounts.filter(a=>a.active).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></>:<><select name="categoryId" defaultValue={m.categoryId||''} aria-label="Categoría"><option value="">Sin categoría</option>{data.categories.filter(c=>c.active&&c.kind===m.kind).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><select name="accountId" defaultValue={m.accountId||''} aria-label="Cuenta">{data.accounts.filter(a=>a.active).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></>}<input name="date" type="date" required defaultValue={m.date} aria-label="Fecha"/>{m.kind!=='transfer'&&<select name="status" defaultValue={m.status} aria-label="Estado">{m.kind==='income'?<><option value="pending">Pendiente</option><option value="received">Recibido</option></>:<><option value="pending">Pendiente</option><option value="paid">Pagado</option></>}</select>}<textarea name="note" defaultValue={m.note} placeholder="Nota"/><button className="primary-button">Guardar cambios</button><button type="button" onClick={()=>setEditing(false)}>Cancelar</button></form>}
 {m.status==='pending'&&<button onClick={()=>updateMovement(m.id,{status:m.kind==='income'?'received':'paid'})}>{m.kind==='income'?'Marcar recibido':'Marcar pagado'}</button>}
 {!editing&&<button onClick={()=>setEditing(true)}>Editar</button>}
 {docs.map(doc=><button key={doc.id} onClick={()=>{const url=URL.createObjectURL(doc.blob);window.open(url,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(url),60000)}}>Abrir {doc.name}</button>)}
 <button onClick={async()=>{if(confirm('¿Enviar este movimiento a la papelera?'))await moveMovementToTrash(m.id)}}>Enviar a papelera</button>{m.note&&!editing&&<p>{m.note}</p>}</div>}</article>{editing&&<MovementEditor movement={m} data={data} documents={docs||[]} onClose={()=>setEditing(false)}/> }</>
}

function MovementEditor({movement,data,documents,onClose}:{movement:import('../../models/entities').Movement;data:ReturnType<typeof useFinanceData>;documents:import('../../models/entities').DocumentRecord[];onClose:()=>void}) {
 const [selectedDocuments,setSelectedDocuments]=useState<string[]>([])
 const [status,setStatus]=useState(movement.status)
 useEffect(()=>{document.body.classList.add('has-modal-open');return()=>document.body.classList.remove('has-modal-open')},[])
 async function save(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault()
  const form=event.currentTarget
  const values=new FormData(form)
  const fileInput=form.elements.namedItem('documents') as HTMLInputElement|null
  const files=Array.from(fileInput?.files||[])
  const concept=String(values.get('concept')).trim()
  const amount=Number(values.get('amount'))
  const date=String(values.get('date'))
  if(!concept||amount<=0||!date)return
  if(movement.kind==='transfer'){
   const from=String(values.get('fromAccount')||'')
   const to=String(values.get('toAccount')||'')
   if(!from||!to||from===to)return
   await updateMovement(movement.id,{concept,amount,accountId:from,toAccountId:to,date,status:'paid',note:String(values.get('note')||'')})
  }else await updateMovement(movement.id,{concept,amount,categoryId:String(values.get('categoryId')||'')||undefined,accountId:String(values.get('accountId')||'')||undefined,date,status:String(values.get('status')) as 'paid'|'pending'|'received',note:String(values.get('note')||'')})
  if(files.length)await attachDocumentsToMovement(movement.id,files)
  onClose()
 }
 const recurringItem=movement.recurringItemId?data.recurringItems.find(item=>item.id===movement.recurringItemId):undefined
 async function remove(){
  if(recurringItem){
   const date=movement.recurrenceDate||movement.date
   if(!window.confirm(`¿Eliminar solo este movimiento recurrente de ${new Date(`${date}T12:00:00`).toLocaleDateString('es-ES')}? Los siguientes meses seguirán programados.`))return
   await skipRecurringOccurrence(recurringItem.id,date)
  }else{
   if(!window.confirm('¿Enviar este movimiento a la papelera?'))return
   await moveMovementToTrash(movement.id)
  }
  onClose()
 }
 const categoryOptions=data.categories.filter(category=>category.active&&category.kind===movement.kind)
 const accountOptions=data.accounts.filter(account=>account.active||account.id===movement.accountId||account.id===movement.toAccountId)
 return <div className="quick-add-overlay movement-editor-overlay" role="presentation"><button className="quick-add-backdrop" type="button" aria-label="Cerrar editor" onClick={onClose}/><section className="quick-add-sheet movement-editor-sheet" role="dialog" aria-modal="true" aria-labelledby={`movement-title-${movement.id}`}><div className="sheet-grabber" aria-hidden="true"/><header className="quick-add-header"><div><p className="eyebrow">Movimiento</p><h2 id={`movement-title-${movement.id}`}>{movement.concept}</h2><p>Modifica los datos de este movimiento.</p></div><button className="sheet-close" type="button" aria-label="Cerrar" onClick={onClose}>×</button></header><form className="occurrence-form movement-editor-form" onSubmit={save}>
  <label className="form-field"><span>Concepto</span><input name="concept" required defaultValue={movement.concept}/></label>
  <label className="form-field"><span>Importe</span><span className="amount-input-wrap"><input name="amount" type="number" min="0.01" step="0.01" required defaultValue={movement.amount}/><span>€</span></span></label>
  {movement.kind==='transfer'?<><label className="form-field"><span>Cuenta de origen</span><select name="fromAccount" required defaultValue={movement.accountId||''}>{accountOptions.map(account=><option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label className="form-field"><span>Cuenta de destino</span><select name="toAccount" required defaultValue={movement.toAccountId||''}>{accountOptions.map(account=><option key={account.id} value={account.id}>{account.name}</option>)}</select></label></>:<><label className="form-field"><span>Categoría</span><select name="categoryId" defaultValue={movement.categoryId||''}><option value="">Sin categoría</option>{categoryOptions.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="form-field"><span>Cuenta</span><select name="accountId" defaultValue={movement.accountId||''}><option value="">Sin cuenta</option>{accountOptions.map(account=><option key={account.id} value={account.id}>{account.name}</option>)}</select></label></>}
  <label className="form-field"><span>Fecha exacta</span><input name="date" type="date" required defaultValue={movement.date}/></label>
  {movement.kind!=='transfer'&&<fieldset className="status-field"><legend>Estado</legend><div className="status-options"><label className={`status-option${status==='pending'?' is-selected':''}`}><input type="radio" name="status" value="pending" checked={status==='pending'} onChange={()=>setStatus('pending')}/><span className="status-dot"/>Pendiente</label><label className={`status-option${status===(movement.kind==='income'?'received':'paid')?' is-selected':''}`}><input type="radio" name="status" value={movement.kind==='income'?'received':'paid'} checked={status===(movement.kind==='income'?'received':'paid')} onChange={()=>setStatus(movement.kind==='income'?'received':'paid')}/><span className="status-dot"/>{movement.kind==='income'?'Recibido':'Pagado'}</label></div></fieldset>}
  <label className="form-field"><span>Nota</span><textarea name="note" rows={3} defaultValue={movement.note}/></label>
  {documents.length>0&&<div className="movement-editor-documents"><span>Documentos adjuntos</span>{documents.map(doc=><button type="button" key={doc.id} onClick={()=>{const url=URL.createObjectURL(doc.blob);window.open(url,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(url),60000)}}>{doc.name} <span aria-hidden="true">↗</span></button>)}</div>}
  <label className="attachment-button"><span aria-hidden="true">＋</span> Adjuntar documento<input type="file" name="documents" accept="image/*,.pdf" multiple hidden onChange={event=>setSelectedDocuments(Array.from(event.currentTarget.files||[]).map(file=>file.name))}/></label>
  {selectedDocuments.length>0&&<p className="field-hint">{selectedDocuments.join(', ')}</p>}
  <button className="primary-button" type="submit">Guardar cambios</button>
 </form><button className="occurrence-delete-button" type="button" onClick={remove}>{recurringItem?'Eliminar solo este mes':'Enviar a papelera'}</button></section></div>
}

function RecurringEditor({item,data,onClose}:{item:RecurringItem;data:ReturnType<typeof useFinanceData>;onClose:()=>void}) {
 const [reminder,setReminder]=useState(item.reminder===null?'none':item.reminder===1||item.reminder===2||item.reminder===3||item.reminder===5||item.reminder===7?String(item.reminder):'custom')
 useEffect(()=>{document.body.classList.add('has-modal-open');return()=>document.body.classList.remove('has-modal-open')},[])
 async function save(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault()
  const values=new FormData(event.currentTarget)
  const concept=String(values.get('concept')||'').trim()
  const amount=Number(values.get('amount'))
  const accountId=String(values.get('accountId')||'')
  const nextDate=String(values.get('nextDate')||'')
  const reminderValue=String(values.get('reminder')||'none')
  const reminderDays=reminderValue==='none'?null:reminderValue==='custom'?Number(values.get('customReminderDays')):Number(reminderValue)
  if(!concept||amount<=0||!accountId||!nextDate||reminderDays!==null&&(!Number.isInteger(reminderDays)||reminderDays<1))return
  await updateRecurring(item.id,{concept,amount,accountId,categoryId:String(values.get('categoryId')||'')||undefined,frequency:String(values.get('frequency')) as RecurringItem['frequency'],nextDate,reminder:reminderDays,note:String(values.get('note')||'')})
  onClose()
 }
 async function remove(){
  const date=new Date(`${item.nextDate}T12:00:00`).toLocaleDateString('es-ES')
  if(!window.confirm(`¿Eliminar «${item.concept}» desde el ${date} en adelante? Se quitarán sus próximos vencimientos pendientes. Los movimientos anteriores se conservarán.`))return
  await deleteRecurringFromDate(item.id,item.nextDate)
  onClose()
 }
 const categories=data.categories.filter(category=>category.active&&category.kind===item.kind)
 const accounts=data.accounts.filter(account=>account.active||account.id===item.accountId)
 return <div className="quick-add-overlay movement-editor-overlay" role="presentation"><button className="quick-add-backdrop" type="button" aria-label="Cerrar editor" onClick={onClose}/><section className="quick-add-sheet movement-editor-sheet recurring-editor-sheet" role="dialog" aria-modal="true" aria-labelledby={`recurring-title-${item.id}`}><div className="sheet-grabber" aria-hidden="true"/><header className="quick-add-header"><div><p className="eyebrow">{item.kind==='income'?'Ingreso recurrente':'Gasto recurrente'}</p><h2 id={`recurring-title-${item.id}`}>{item.concept}</h2><p>Edita la programación y los datos de sus próximos vencimientos.</p></div><button className="sheet-close" type="button" aria-label="Cerrar" onClick={onClose}>×</button></header><form className="occurrence-form movement-editor-form" onSubmit={save}>
  <label className="form-field"><span>Nombre</span><input name="concept" required defaultValue={item.concept}/></label>
  <label className="form-field"><span>Importe</span><span className="amount-input-wrap"><input name="amount" type="number" min="0.01" step="0.01" required defaultValue={item.amount}/><span>€</span></span></label>
  <label className="form-field"><span>Cuenta</span><select name="accountId" required defaultValue={item.accountId||''}><option value="" disabled>Elige una cuenta</option>{accounts.map(account=><option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
  <label className="form-field"><span>Categoría</span><select name="categoryId" defaultValue={item.categoryId||''}><option value="">Sin categoría</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
  <label className="form-field"><span>Frecuencia</span><select name="frequency" defaultValue={item.frequency}><option value="weekly">Cada semana</option><option value="biweekly">Cada dos semanas</option><option value="monthly">Cada mes</option><option value="yearly">Cada año</option></select></label>
  <label className="form-field"><span>Próxima fecha</span><input name="nextDate" type="date" required defaultValue={item.nextDate}/></label>
  <label className="form-field"><span>Recordatorio</span><select name="reminder" value={reminder} onChange={event=>setReminder(event.target.value)}><option value="none">Sin recordatorio</option><option value="1">1 día antes</option><option value="2">2 días antes</option><option value="3">3 días antes</option><option value="5">5 días antes</option><option value="7">7 días antes</option><option value="custom">Personalizado</option></select></label>
  {reminder==='custom'&&<label className="form-field"><span>Días de antelación</span><input name="customReminderDays" type="number" min="1" step="1" required defaultValue={item.reminder&&item.reminder>0?item.reminder:undefined}/></label>}
  <label className="form-field"><span>Nota <span className="optional-label">Opcional</span></span><textarea name="note" rows={3} defaultValue={item.note}/></label>
  <button className="primary-button" type="submit">Guardar cambios</button>
 </form><button className="occurrence-delete-button" type="button" onClick={remove}>Eliminar desde el próximo vencimiento</button></section></div>
}

function downloadBackup(blob:Blob) {
 const link=document.createElement('a')
 const url=URL.createObjectURL(blob)
 link.href=url
 link.download=`Finanzas_Backup_${dateKey()}.fbk`
 link.click()
 window.setTimeout(()=>URL.revokeObjectURL(url),30_000)
}

function rememberBackupDate() {
 const value=new Date().toISOString()
 try { localStorage.setItem('finanzas.backup.lastExport',value) } catch { /* The download remains valid even when storage is unavailable. */ }
 return value
}

function BackupSettings() {
 const [createPassword,setCreatePassword]=useState('')
 const [confirmPassword,setConfirmPassword]=useState('')
 const [restorePassword,setRestorePassword]=useState('')
 const [restoreFile,setRestoreFile]=useState<File|null>(null)
 const [message,setMessage]=useState('')
 const [busy,setBusy]=useState(false)
 const [lastExport,setLastExport]=useState(()=>{try{return localStorage.getItem('finanzas.backup.lastExport')}catch{return null}})

 async function create(event:React.FormEvent<HTMLFormElement>) {
  event.preventDefault()
  setMessage('')
  if(createPassword.length<8){setMessage('La contraseña debe tener al menos 8 caracteres.');return}
  if(createPassword!==confirmPassword){setMessage('Las contraseñas no coinciden.');return}
  setBusy(true)
  try {
   const blob=await createEncryptedBackup(createPassword)
   downloadBackup(blob)
   setLastExport(rememberBackupDate())
   setCreatePassword('');setConfirmPassword('')
   setMessage('Copia cifrada preparada para guardar en Archivos.')
  } catch { setMessage('No se pudo crear la copia. Comprueba que el navegador permita cifrado seguro y vuelve a intentarlo.') }
  finally { setBusy(false) }
 }

 async function restore(event:React.FormEvent<HTMLFormElement>) {
  event.preventDefault()
  const form=event.currentTarget
  setMessage('')
  if(!restoreFile){setMessage('Selecciona primero un archivo .fbk.');return}
  if(restorePassword.length<8){setMessage('Introduce la contraseña de la copia.');return}
  setBusy(true)
  try {
   const snapshot=await readEncryptedBackup(restoreFile,restorePassword)
   if(!window.confirm('Se reemplazarán las cuentas, movimientos, recurrencias, documentos y ajustes actuales por los del archivo. ¿Continuar?'))return
   if(window.confirm('¿Quieres descargar ahora una copia cifrada de los datos actuales antes de reemplazarlos? Se usará la misma contraseña que acabas de introducir.')) {
    const safetyCopy=await createEncryptedBackup(restorePassword)
    downloadBackup(safetyCopy)
    setLastExport(rememberBackupDate())
   }
   await restoreBackup(snapshot)
   setRestorePassword('');setRestoreFile(null)
   const input=form.elements.namedItem('restoreFile') as HTMLInputElement|null
   if(input)input.value=''
   setMessage('Copia restaurada correctamente.')
  } catch(error) {
   setMessage(error instanceof DOMException&&error.name==='OperationError'?'No se pudo descifrar la copia. Comprueba la contraseña y que el archivo no esté dañado.':'El archivo no es una copia compatible o está dañado. No se han reemplazado tus datos.')
  } finally { setBusy(false) }
 }

 return <>
  <section className="activity-card backup-card">
   <h2>Copias cifradas</h2>
   <p className="empty-copy">Guarda tus datos en un archivo protegido por contraseña. Incluye perfil, cuentas, movimientos, recurrencias, categorías, presupuestos, papelera y documentos adjuntos.</p>
   <div className="backup-last-export"><span>Última copia preparada</span><b>{lastExport?new Date(lastExport).toLocaleString('es-ES'):'Todavía no has creado una copia'}</b></div>
   <form className="backup-form" onSubmit={create}>
    <h3>Crear copia</h3>
    <label className="form-field"><span>Contraseña</span><input type="password" autoComplete="new-password" minLength={8} required value={createPassword} onChange={event=>setCreatePassword(event.target.value)} placeholder="Mínimo 8 caracteres"/></label>
    <label className="form-field"><span>Repite la contraseña</span><input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} placeholder="Confirma la contraseña"/></label>
    <p className="field-hint">Anótala en un lugar seguro. Si la pierdes, no se podrá abrir el archivo.</p>
    <button className="primary-button" type="submit" disabled={busy}>{busy?'Preparando…':'Crear copia de seguridad'}</button>
   </form>
  </section>
  <section className="activity-card backup-card">
   <h2>Restaurar una copia</h2>
   <p className="empty-copy">Elige un archivo .fbk y escribe la contraseña con la que se creó. Podrás guardar una copia de los datos actuales antes de reemplazarlos.</p>
   <form className="backup-form" onSubmit={restore}>
    <label className="form-field"><span>Archivo de copia</span><input name="restoreFile" type="file" accept=".fbk,application/octet-stream" required onChange={event=>setRestoreFile(event.target.files?.[0]||null)}/></label>
    <label className="form-field"><span>Contraseña de la copia</span><input type="password" autoComplete="current-password" required value={restorePassword} onChange={event=>setRestorePassword(event.target.value)} placeholder="Contraseña usada al crearla"/></label>
    <button className="primary-button" type="submit" disabled={busy||!restoreFile}>{busy?'Comprobando…':'Restaurar copia'}</button>
   </form>
  </section>
  {message&&<p className="field-hint backup-message" role="status">{message}</p>}
 </>
}

function AccountsEditor({accounts,onClose,onTransfer}:{accounts:Account[];onClose:()=>void;onTransfer?:()=>void}) {
 const [saving,setSaving]=useState(false)
 const [confirmation,setConfirmation]=useState<'added'|'updated'|'deleted'|null>(null)
 const [addFormOpen,setAddFormOpen]=useState(false)
 const [selectedAccount,setSelectedAccount]=useState<Account|null>(null)
 const [confirmDelete,setConfirmDelete]=useState(false)
 const [error,setError]=useState('')
 const activeAccounts=accounts.filter(account=>account.active)
 useEffect(()=>{document.body.classList.add('has-modal-open');return()=>document.body.classList.remove('has-modal-open')},[])
 async function submit(event:React.FormEvent<HTMLFormElement>) {
  event.preventDefault()
  const form=event.currentTarget
  const values=new FormData(form)
  const name=String(values.get('name')||'').trim()
  const balance=Number(values.get('balance')||0)
  if(!name){setError('Escribe un nombre para la cuenta.');return}
  if(!Number.isFinite(balance)){setError('Introduce un saldo inicial válido.');return}
  setSaving(true);setError('')
  try {
   await addAccount({name,kind:String(values.get('kind')) as Account['kind'],balance})
   setAddFormOpen(false)
   setConfirmation('added')
  } catch { setError('No se pudo añadir la cuenta. Inténtalo de nuevo.') }
  finally { setSaving(false) }
 }
 async function saveSelectedAccount(event:React.FormEvent<HTMLFormElement>) {
  event.preventDefault()
  if(!selectedAccount)return
  const values=new FormData(event.currentTarget)
  const name=String(values.get('name')||'').trim()
  const balance=Number(values.get('balance'))
  if(!name){setError('Escribe un nombre para la cuenta.');return}
  if(!Number.isFinite(balance)){setError('Introduce un saldo válido.');return}
  setSaving(true);setError('')
  try {
   await database.accounts.update(selectedAccount.id,{name,kind:String(values.get('kind')) as Account['kind'],balance,active:true})
   setSelectedAccount(null)
   setConfirmation('updated')
  } catch { setError('No se pudieron guardar los cambios. Inténtalo de nuevo.') }
  finally { setSaving(false) }
 }
 async function removeSelectedAccount() {
  if(!selectedAccount)return
  setSaving(true);setError('')
  try {
   const currentAccounts=await database.accounts.toArray()
   if(currentAccounts.filter(account=>account.active).length<=1){setConfirmDelete(false);setError('No puedes eliminar la última cuenta activa. Añade otra cuenta primero.');return}
   const linkedRecurring=(await database.recurringItems.toArray()).filter(item=>item.active&&item.accountId===selectedAccount.id)
   if(linkedRecurring.length){setConfirmDelete(false);setError(`Antes de eliminar esta cuenta, reasigna ${linkedRecurring.length===1?'el movimiento recurrente activo':'los movimientos recurrentes activos'} desde Ajustes → Movimientos recurrentes.`);return}
   await database.accounts.update(selectedAccount.id,{active:false})
   setSelectedAccount(null)
   setConfirmDelete(false)
   setConfirmation('deleted')
  } catch { setError('No se pudo eliminar la cuenta. Inténtalo de nuevo.') }
  finally { setSaving(false) }
 }
 return <div className="quick-add-overlay movement-editor-overlay" role="presentation">
  <button className="quick-add-backdrop" type="button" aria-label="Cerrar Cuentas" onClick={onClose}/>
  <section className="quick-add-sheet movement-editor-sheet accounts-editor-sheet" role="dialog" aria-modal="true" aria-labelledby="accounts-editor-title">
   <div className="sheet-grabber" aria-hidden="true"/>
   <header className="quick-add-header"><div><p className="eyebrow">Ajustes</p><h2 id="accounts-editor-title">Cuentas</h2><p>Gestiona tus cuentas y añade otra cuando quieras.</p></div><button className="sheet-close" type="button" aria-label="Cerrar" onClick={onClose}>×</button></header>
   <div className="accounts-editor-content">
    <section className="accounts-list-section" aria-label="Tus cuentas">
     <div className="accounts-list-heading"><h3>Tus cuentas</h3><span>{activeAccounts.length} {activeAccounts.length===1?'activa':'activas'}</span></div>
     {activeAccounts.length ? activeAccounts.map(account=><button className="account-modal-row" type="button" key={account.id} aria-haspopup="dialog" onClick={()=>{setError('');setSelectedAccount(account)}}><span className="account-modal-icon" aria-hidden="true">{{bank:'▤',cash:'€',card:'▭',savings:'◈'}[account.kind]}</span><span className="account-modal-copy"><b>{account.name}</b><small>{{bank:'Cuenta bancaria',cash:'Efectivo',card:'Tarjeta',savings:'Ahorro'}[account.kind]}</small></span><span className="account-modal-balance">{euro(account.balance)}</span><span className="account-modal-chevron" aria-hidden="true">›</span></button>):<p className="empty-copy accounts-empty">Aún no tienes cuentas. Añade una para empezar a registrar movimientos.</p>}
    </section>
    {onTransfer&&<button className="accounts-transfer-button" type="button" onClick={onTransfer}><span aria-hidden="true">⇄</span><span><b>Transferir entre cuentas</b><small>Mueve dinero de una cuenta a otra</small></span><span className="account-modal-chevron" aria-hidden="true">›</span></button>}
    <button className="primary-button accounts-add-button" type="button" onClick={()=>{setError('');setAddFormOpen(true)}}>＋ Añadir nueva cuenta</button>
   </div>
  </section>
  {addFormOpen&&<div className="quick-add-overlay account-detail-overlay" role="presentation"><button className="quick-add-backdrop" type="button" aria-label="Cerrar nueva cuenta" onClick={()=>setAddFormOpen(false)}/><section className="quick-add-sheet movement-editor-sheet account-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="new-account-title"><div className="sheet-grabber" aria-hidden="true"/><header className="quick-add-header"><div><p className="eyebrow">Ajustes · Cuentas</p><h2 id="new-account-title">Añadir nueva cuenta</h2><p>Introduce los datos de la cuenta.</p></div><button className="sheet-close" type="button" aria-label="Cerrar" onClick={()=>setAddFormOpen(false)}>×</button></header><form className="occurrence-form account-detail-form" onSubmit={submit}><label className="form-field"><span>Nombre</span><input name="name" required autoFocus maxLength={60} placeholder="Ej. Cuenta principal"/></label><label className="form-field"><span>Tipo de cuenta</span><select name="kind" defaultValue="bank"><option value="bank">Banco</option><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="savings">Ahorro</option></select></label><label className="form-field"><span>Saldo inicial</span><span className="amount-input-wrap"><input name="balance" type="number" step="0.01" defaultValue="0"/><span>€</span></span></label>{error&&<p className="field-hint" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={saving}>{saving?'Guardando…':'Añadir cuenta'}</button></form></section></div>}
  {selectedAccount&&<div className="quick-add-overlay account-detail-overlay" role="presentation"><button className="quick-add-backdrop" type="button" aria-label="Cerrar cuenta" onClick={()=>{setSelectedAccount(null);setError('')}}/><section className="quick-add-sheet movement-editor-sheet account-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="account-detail-title"><div className="sheet-grabber" aria-hidden="true"/><header className="quick-add-header"><div><p className="eyebrow">Ajustes · Cuentas</p><h2 id="account-detail-title">Editar cuenta</h2><p>Actualiza los datos de esta cuenta.</p></div><button className="sheet-close" type="button" aria-label="Cerrar" onClick={()=>{setSelectedAccount(null);setError('')}}>×</button></header><form className="occurrence-form account-detail-form" onSubmit={saveSelectedAccount}><label className="form-field"><span>Nombre</span><input name="name" required maxLength={60} defaultValue={selectedAccount.name}/></label><label className="form-field"><span>Tipo de cuenta</span><select name="kind" defaultValue={selectedAccount.kind}><option value="bank">Banco</option><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="savings">Ahorro</option></select></label><label className="form-field"><span>Saldo actual</span><span className="amount-input-wrap"><input name="balance" type="number" step="0.01" required defaultValue={selectedAccount.balance}/><span>€</span></span></label>{error&&<><p className="field-hint" role="alert">{error}</p>{error.startsWith('No puedes eliminar la última cuenta activa')&&<button className="account-add-another" type="button" onClick={()=>{setSelectedAccount(null);setError('');setAddFormOpen(true)}}>Añadir otra cuenta</button>}</>}<button className="primary-button" type="submit" disabled={saving}>{saving?'Guardando…':'Guardar cambios'}</button><button className="occurrence-delete-button" type="button" disabled={saving} onClick={()=>setConfirmDelete(true)}>Eliminar cuenta</button><p className="account-history-note">Los movimientos anteriores se conservarán en el historial.</p></form></section></div>}
  {confirmDelete&&selectedAccount&&<div className="quick-add-overlay profile-success-overlay" role="presentation"><button className="quick-add-backdrop" type="button" aria-label="Cancelar eliminación" onClick={()=>setConfirmDelete(false)}/><section className="profile-success-dialog account-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="account-delete-title" aria-describedby="account-delete-message"><span className="account-delete-icon" aria-hidden="true">!</span><h2 id="account-delete-title">¿Eliminar cuenta?</h2><p id="account-delete-message">«{selectedAccount.name}» dejará de aparecer en Cuentas y no podrás seleccionarla en nuevos movimientos. Su historial se conservará.</p><div className="account-delete-actions"><button type="button" className="account-delete-cancel" disabled={saving} onClick={()=>setConfirmDelete(false)}>Cancelar</button><button type="button" className="account-delete-confirm" disabled={saving} onClick={()=>void removeSelectedAccount()}>{saving?'Eliminando…':'Eliminar cuenta'}</button></div></section></div>}
  {confirmation&&<div className="quick-add-overlay profile-success-overlay" role="presentation"><button className="quick-add-backdrop" type="button" aria-label="Cerrar confirmación" onClick={onClose}/><section className="profile-success-dialog" role="alertdialog" aria-modal="true" aria-labelledby="account-saved-title" aria-describedby="account-saved-message"><span className="profile-success-icon" aria-hidden="true">✓</span><h2 id="account-saved-title">{confirmation==='added'?'Cuenta agregada':confirmation==='updated'?'Cuenta actualizada':'Cuenta eliminada'}</h2><p id="account-saved-message">{confirmation==='added'?'La cuenta se ha guardado correctamente en este dispositivo.':confirmation==='updated'?'Los cambios se han guardado correctamente.':'La cuenta se quitó de Cuentas y su historial se ha conservado.'}</p><button className="primary-button" type="button" onClick={onClose}>Aceptar</button></section></div>}
 </div>
}

function ProfileEditor({profile,onClose}:{profile:Profile|undefined;onClose:()=>void}) {
 const [name,setName]=useState(profile?.name||'')
 const [saving,setSaving]=useState(false)
 const [saved,setSaved]=useState(false)
 const [error,setError]=useState('')
 useEffect(()=>{document.body.classList.add('has-modal-open');return()=>document.body.classList.remove('has-modal-open')},[])
 useEffect(()=>{if(profile?.name)setName(profile.name)},[profile?.name])
 async function save(event:React.FormEvent<HTMLFormElement>) {
  event.preventDefault()
  const normalized=name.trim()
  if(!normalized){setError('Escribe un nombre para guardar el perfil.');return}
  setSaving(true);setError('')
  try {
   await database.profiles.put({id:'local',name:normalized,currency:'EUR',createdAt:profile?.createdAt||new Date().toISOString()})
   setSaved(true)
  } catch { setError('No se pudo guardar el perfil. Inténtalo de nuevo.') }
  finally { setSaving(false) }
 }
 return <div className="quick-add-overlay movement-editor-overlay" role="presentation">
  <button className="quick-add-backdrop" type="button" aria-label="Cerrar Mi perfil" onClick={onClose}/>
  <section className="quick-add-sheet movement-editor-sheet profile-editor-sheet" role="dialog" aria-modal="true" aria-labelledby="profile-editor-title">
   <div className="sheet-grabber" aria-hidden="true"/>
   <header className="quick-add-header"><div><p className="eyebrow">Ajustes</p><h2 id="profile-editor-title">Mi perfil</h2><p>Personaliza el nombre de tu espacio financiero.</p></div><button className="sheet-close" type="button" aria-label="Cerrar" onClick={onClose}>×</button></header>
   <div className="profile-card"><span className="profile-avatar">●</span><div><b>{name.trim()||'Mi espacio'}</b><small>Usuario local</small></div></div>
   <form className="occurrence-form profile-editor-form" onSubmit={save}>
    <label className="form-field"><span>Nombre</span><input autoFocus required maxLength={60} value={name} onChange={event=>setName(event.target.value)} placeholder="Mi espacio"/></label>
    <div className="settings-info-row"><span>Moneda</span><b>Euro (€)</b></div>
    <div className="settings-info-row"><span>Zona horaria</span><b>Hora local del dispositivo</b></div>
    <p className="settings-info"><span>ⓘ</span> Estos datos se guardan únicamente en tu dispositivo.</p>
    {error&&<p className="field-hint" role="alert">{error}</p>}
    <button className="primary-button" type="submit" disabled={saving}>{saving?'Guardando…':'Guardar perfil'}</button>
   </form>
  </section>
  {saved&&<div className="quick-add-overlay profile-success-overlay" role="presentation"><button className="quick-add-backdrop" type="button" aria-label="Cerrar confirmación" onClick={onClose}/><section className="profile-success-dialog" role="alertdialog" aria-modal="true" aria-labelledby="profile-saved-title" aria-describedby="profile-saved-message"><span className="profile-success-icon" aria-hidden="true">✓</span><h2 id="profile-saved-title">Perfil guardado</h2><p id="profile-saved-message">Los cambios se han guardado correctamente en este dispositivo.</p><button className="primary-button" type="button" onClick={onClose}>Aceptar</button></section></div>}
 </div>
}
