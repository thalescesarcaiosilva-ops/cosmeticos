import { Pencil } from 'lucide-react'
import type { ReactNode } from 'react'

type CheckoutStepCardProps = {
  step: number
  title: string
  subtitle?: string
  status: 'pending' | 'active' | 'completed'
  summary?: ReactNode
  onEdit?: () => void
  children?: ReactNode
}

export function CheckoutStepCard({
  step,
  title,
  subtitle,
  status,
  summary,
  onEdit,
  children,
}: CheckoutStepCardProps) {
  const isActive = status === 'active'
  const isCompleted = status === 'completed'
  const isPending = status === 'pending'

  return (
    <section
      className={`overflow-hidden rounded-lg border bg-surface transition-colors ${
        isActive
          ? 'border-brand shadow-sm'
          : isCompleted
            ? 'border-border'
            : 'border-border opacity-70'
      }`}
      aria-labelledby={`checkout-step-${step}-title`}
    >
      <div className="flex items-start justify-between gap-4 px-5 py-4 md:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
              isCompleted
                ? 'bg-brand text-white'
                : isActive
                  ? 'bg-brand text-white'
                  : 'border-2 border-border-strong bg-surface text-text-muted'
            }`}
          >
            {isCompleted ? (
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
                <path
                  d="M3 8.5L6.5 12L13 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              step
            )}
          </span>
          <div className="min-w-0">
            <h2
              id={`checkout-step-${step}-title`}
              className="text-sm font-bold uppercase tracking-wide text-text-primary"
            >
              {title}
            </h2>
            {isActive && subtitle && (
              <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
            )}
            {isCompleted && summary && (
              <div className="mt-2 text-sm text-text-secondary">{summary}</div>
            )}
          </div>
        </div>

        {isCompleted && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover"
          >
            <Pencil className="size-3.5" aria-hidden />
            Editar
          </button>
        )}
      </div>

      {isActive && children && (
        <div className="border-t border-border px-5 pb-5 pt-4 md:px-6 md:pb-6">{children}</div>
      )}

      {isPending && (
        <div className="border-t border-border px-5 py-3 md:px-6">
          <p className="text-xs text-text-muted">Complete a etapa anterior para continuar.</p>
        </div>
      )}
    </section>
  )
}
