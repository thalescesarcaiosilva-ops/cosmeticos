import {
  FUNNEL_STEPS,
  FUNNEL_STEP_HINT,
  FUNNEL_STEP_LABEL,
  type FunnelStep,
} from '@/lib/analytics/funnel-steps'

export type FunnelCountRow = {
  step: string
  sessions: number
}

type FunnelReportProps = {
  week: FunnelCountRow[]
  month: FunnelCountRow[]
  error: string | null
}

function countOf(rows: FunnelCountRow[], step: FunnelStep) {
  return rows.find((row) => row.step === step)?.sessions ?? 0
}

function biggestDrop(rows: FunnelCountRow[]): string | null {
  let best: { label: string; rate: number; lost: number } | null = null

  for (let index = 0; index < FUNNEL_STEPS.length - 1; index += 1) {
    const current = FUNNEL_STEPS[index]
    const next = FUNNEL_STEPS[index + 1]
    const currentCount = countOf(rows, current)
    const nextCount = countOf(rows, next)
    if (currentCount < 5 || nextCount > currentCount) continue
    const lost = currentCount - nextCount
    if (lost <= 0) continue
    const rate = lost / currentCount
    if (!best || rate > best.rate) {
      best = { label: FUNNEL_STEP_LABEL[current], rate, lost }
    }
  }

  if (!best) return null
  return `Maior queda nos últimos 7 dias: ${best.lost} sessões não passaram de “${best.label}” (${Math.round(best.rate * 100)}%).`
}

export function FunnelReport({ week, month, error }: FunnelReportProps) {
  const weekTotal = week.reduce((sum, row) => sum + row.sessions, 0)
  const drop = biggestDrop(week)

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-text-secondary">
          Sessões distintas em cada etapa. Uma pessoa conta uma vez por etapa, mesmo que
          volte na mesma visita. Não guarda nome, e-mail nem o que estava no carrinho.
        </p>
        <p className="mt-2 text-sm text-text-secondary">
          “Compre agora” pula a tela do carrinho, então o checkout pode ter mais sessões
          do que o carrinho. Quem para no frete aparece em “Checkout — frete” e não chega
          em pagamento. A contagem começa a partir de agora.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-badge-discount/30 bg-badge-discount/10 px-4 py-3 text-sm text-badge-discount">
          Não foi possível ler o funil agora.
        </p>
      ) : null}

      {drop ? (
        <p className="rounded-md border border-border bg-surface px-4 py-3 text-sm font-medium text-text-primary">
          {drop}
        </p>
      ) : weekTotal === 0 ? (
        <p className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-text-secondary">
          Ainda não há visitas medidas. A contagem começa agora, conforme as pessoas
          navegam na loja.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">Etapa</th>
              <th className="px-4 py-3 font-medium">7 dias</th>
              <th className="px-4 py-3 font-medium">30 dias</th>
              <th className="px-4 py-3 font-medium">Pararam aqui (7 dias)</th>
            </tr>
          </thead>
          <tbody>
            {FUNNEL_STEPS.map((step, index) => {
              const weekCount = countOf(week, step)
              const monthCount = countOf(month, step)
              const next = FUNNEL_STEPS[index + 1]
              const nextCount = next ? countOf(week, next) : 0
              const stopped =
                next && weekCount >= nextCount ? weekCount - nextCount : null
              const max = Math.max(countOf(week, 'product'), weekCount, 1)
              const width = Math.round((weekCount / max) * 100)

              return (
                <tr key={step} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary">{FUNNEL_STEP_LABEL[step]}</p>
                    <p className="text-xs text-text-secondary">{FUNNEL_STEP_HINT[step]}</p>
                    <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-text-primary">{weekCount}</td>
                  <td className="px-4 py-3 tabular-nums text-text-primary">{monthCount}</td>
                  <td className="px-4 py-3 tabular-nums text-text-secondary">
                    {stopped == null ? '—' : stopped}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
