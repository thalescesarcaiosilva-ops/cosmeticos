type Step = {
  id: number
  label: string
  status: 'done' | 'active' | 'pending'
}

const STEPS: Step[] = [
  { id: 1, label: 'Sacola', status: 'done' },
  { id: 2, label: 'Pagamento', status: 'active' },
  { id: 3, label: 'Recibo', status: 'pending' },
]

export function CheckoutStepper() {
  return (
    <nav aria-label="Progresso do checkout" className="border-b border-border pb-6">
      <ol className="flex items-center justify-center gap-2 sm:gap-4">
        {STEPS.map((step, index) => {
          const isDone = step.status === 'done'
          const isActive = step.status === 'active'

          return (
            <li key={step.id} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={`flex size-8 items-center justify-center rounded-full text-xs font-bold sm:size-9 sm:text-sm ${
                    isDone
                      ? 'bg-brand text-white'
                      : isActive
                        ? 'bg-brand text-white ring-4 ring-brand/15'
                        : 'border-2 border-border-strong bg-surface text-text-muted'
                  }`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isDone ? (
                    <svg viewBox="0 0 16 16" className="size-3.5 sm:size-4" fill="none" aria-hidden>
                      <path
                        d="M3 8.5L6.5 12L13 4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    step.id
                  )}
                </span>
                <span
                  className={`text-[10px] font-semibold sm:text-xs ${
                    isActive || isDone ? 'text-brand' : 'text-text-muted'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {index < STEPS.length - 1 && (
                <div
                  className={`mx-2 h-0.5 w-6 sm:mx-3 sm:w-10 ${
                    isDone || isActive ? 'bg-brand' : 'bg-border'
                  }`}
                  aria-hidden
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
