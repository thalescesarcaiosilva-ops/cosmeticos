type CheckoutStep = 1 | 2 | 3

const STEPS: { id: CheckoutStep; label: string }[] = [
  { id: 1, label: 'Dados' },
  { id: 2, label: 'Entrega' },
  { id: 3, label: 'Pagamento' },
]

const HINTS: Record<CheckoutStep, string> = {
  1: 'Seus dados para enviarmos a confirmação do pedido',
  2: 'Endereço e frete, com o prazo antes de pagar',
  3: 'Pagamento seguro para concluir a compra',
}

export function CheckoutStepper({ currentStep }: { currentStep: CheckoutStep }) {
  return (
    <nav aria-label="Progresso do checkout" className="border-b border-border pb-6">
      <ol className="flex items-start justify-center">
        {STEPS.map((step, index) => {
          const isDone = step.id < currentStep
          const isActive = step.id === currentStep

          return (
            <li key={step.id} className="flex items-start">
              <div className="flex w-[4.5rem] flex-col items-center gap-1.5 sm:w-24">
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
                  className={`text-center text-[11px] font-semibold sm:text-xs ${
                    isActive || isDone ? 'text-brand' : 'text-text-muted'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {index < STEPS.length - 1 && (
                <div
                  className={`mt-4 h-0.5 w-8 sm:w-14 ${isDone ? 'bg-brand' : 'bg-border'}`}
                  aria-hidden
                />
              )}
            </li>
          )
        })}
      </ol>
      <p className="mt-4 text-center text-sm text-text-secondary">{HINTS[currentStep]}</p>
    </nav>
  )
}
