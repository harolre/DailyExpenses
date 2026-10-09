export function AccountRequiredNotice({ activeCount, minimum = 1, onAddAccount }: { activeCount: number; minimum?: number; onAddAccount: () => void }) {
  const transferNeedsMore = minimum === 2
  return <div className="account-required-notice" role="note">
    <span className="account-required-icon" aria-hidden="true">ⓘ</span>
    <div><b>{transferNeedsMore ? activeCount ? 'Añade otra cuenta para transferir' : 'Necesitas dos cuentas activas' : 'Necesitas una cuenta activa'}</b><small>{transferNeedsMore ? 'Las transferencias necesitan una cuenta de origen y otra de destino.' : 'Cada movimiento debe quedar asociado a una cuenta para actualizar el saldo.'}</small></div>
    <button type="button" onClick={onAddAccount}>{transferNeedsMore && activeCount ? 'Añadir otra' : 'Añadir cuenta'}</button>
  </div>
}
