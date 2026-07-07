import type { ReactNode } from 'react'

type CheckoutPanelProps = {
  title: string
  children: ReactNode
  className?: string
}

export function CheckoutPanel({ title, children, className = '' }: CheckoutPanelProps) {
  return (
    <section
      className={`overflow-hidden rounded-lg border border-border bg-surface ${className}`}
      aria-label={title}
    >
      <div className="border-b border-border px-4 py-3 md:px-5 md:py-4">
        <h2 className="text-sm font-bold text-text-primary md:text-base">{title}</h2>
      </div>
      <div className="px-4 py-4 md:px-5 md:py-5">{children}</div>
    </section>
  )
}
