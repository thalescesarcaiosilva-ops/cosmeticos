type CardProps = {
  title?: string
  children: React.ReactNode
  className?: string
}

export function Card({ title, children, className = '' }: CardProps) {
  return (
    <div className={`rounded-lg border border-border bg-surface p-6 shadow-sm ${className}`}>
      {title && <h2 className="mb-4 text-lg font-semibold text-text-primary">{title}</h2>}
      {children}
    </div>
  )
}
