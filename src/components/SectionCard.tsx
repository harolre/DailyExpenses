type SectionCardProps = { title: string; icon: string; value?: string }

export function SectionCard({ title, icon, value = '0,00 €' }: SectionCardProps) {
  return (
    <article className="summary-card">
      <div className="summary-card-title"><span className="summary-icon" aria-hidden="true">{icon}</span><span>{title}</span></div>
      <p className="summary-value">{value}</p>
      <p className="summary-caption">Este mes</p>
    </article>
  )
}
