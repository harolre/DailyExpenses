import { navigationItems, type NavigationItem } from '../../app/navigation'
import { PageHeader } from '../../components/PageHeader'

type PlaceholderPageProps = { section: Exclude<NavigationItem, 'inicio'> }

export function PlaceholderPage({ section }: PlaceholderPageProps) {
  const item = navigationItems.find((candidate) => candidate.id === section)!

  return (
    <div className="page placeholder-page">
      <PageHeader eyebrow="Tu espacio financiero" title={item.label} detail="Una vista sencilla, a tu manera." />
      <div className="coming-card">
        <span className="coming-icon" aria-hidden="true">{item.icon}</span>
        <p className="eyebrow">Preparando el espacio</p>
        <h2>Próximamente</h2>
        <p>Esta sección se construirá paso a paso en la siguiente fase.</p>
      </div>
    </div>
  )
}
