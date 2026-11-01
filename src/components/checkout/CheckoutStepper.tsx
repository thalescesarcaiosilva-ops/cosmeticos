type CheckoutPhase = 1 | 2 | 3

const STEPS: { id: CheckoutPhase; label: string }[] = [
  { id: 1, label: 'Dados e entrega' },
  { id: 2, label: 'Pagamento' },
  { id: 3, label: 'Confirmação' },
]

export function CheckoutStepper({ phase }: { phase: CheckoutPhase }) {
  return (
    <nav aria-label="Progresso do checkout">
      <p className="mb-3 text-center text-[12px] text-text-muted md:hidden">
        Etapa {phase} de 3 · {STEPS[phase - 1]?.label}
      </p>
      <ol className="flex items-center justify-center">
        {STEPS.map((step, index) => {
          const isDone = step.id < phase
          const isActive = step.id === phase

          return (
            <li key={step.id} className="flex items-center">
              <div className="flex items-center gap-2">
                <span
                  className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ${
                    isDone || isActive
                      ? 'bg-brand text-white'
                      : 'border border-[#e7d5dc] bg-white text-text-muted'
                  }`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isDone ? (
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
                    step.id
                  )}
                </span>
                <span
                  className={`hidden text-sm font-semibold sm:inline ${
                    isActive || isDone ? 'text-text-primary' : 'text-text-muted'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {index < STEPS.length - 1 && (
                <div
                  className={`mx-3 h-px w-8 sm:w-16 ${isDone ? 'bg-brand' : 'bg-[#eadfe4]'}`}
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
