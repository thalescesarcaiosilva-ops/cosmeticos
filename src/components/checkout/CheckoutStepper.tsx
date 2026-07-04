type Step = {
  id: number
  label: string
}

const STEPS: Step[] = [
  { id: 1, label: 'Identificação' },
  { id: 2, label: 'Entrega' },
  { id: 3, label: 'Pagamento' },
]

type CheckoutStepperProps = {
  currentStep: number
}

export function CheckoutStepper({ currentStep }: CheckoutStepperProps) {
  return (
    <nav aria-label="Progresso do checkout" className="mt-8">
      <ol className="flex items-center">
        {STEPS.map((step, index) => {
          const isActive = step.id === currentStep
          const isDone = step.id < currentStep

          return (
            <li
              key={step.id}
              className={`flex items-center ${index < STEPS.length - 1 ? 'flex-1' : ''}`}
            >
              <div className="flex flex-col items-center gap-2">
                <span
                  className={`flex size-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    isDone
                      ? 'bg-brand text-white'
                      : isActive
                        ? 'bg-brand text-white ring-4 ring-brand/15'
                        : 'border-2 border-border-strong bg-surface text-text-muted'
                  }`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isDone ? (
                    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
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
                  className={`hidden text-xs font-semibold sm:block ${
                    isActive || isDone ? 'text-brand' : 'text-text-muted'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {index < STEPS.length - 1 && (
                <div
                  className={`mx-2 h-0.5 flex-1 sm:mx-4 ${
                    step.id < currentStep ? 'bg-brand' : 'bg-border'
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
