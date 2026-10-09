type PageHeaderProps = { eyebrow: string; title: string; detail?: string }

export function PageHeader({ eyebrow, title, detail }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="brand-mark" aria-hidden="true">f.</div>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {detail && <p className="page-detail">{detail}</p>}
    </header>
  )
}
