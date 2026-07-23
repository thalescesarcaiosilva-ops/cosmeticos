import { TRACKING_EVENT_LABELS, type TrackingEventType } from '@/lib/tracking/types'

export type TrackingTimelineEvent = {
  id?: string
  sequence: number
  eventType: TrackingEventType | string
  city: string
  state: string
  message: string
  scheduledAt?: string | null
  occurredAt?: string | null
  isManual?: boolean
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function TrackingTimeline({
  events,
  trackingCode,
  compact = false,
}: {
  events: TrackingTimelineEvent[]
  trackingCode?: string | null
  compact?: boolean
}) {
  const sorted = [...events].sort((a, b) => a.sequence - b.sequence)
  const visible = compact
    ? sorted.filter((event) => event.occurredAt)
    : sorted

  if (!visible.length) {
    return (
      <p className="text-sm text-text-secondary">
        Ainda não há movimentações de rastreio para este pedido.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {trackingCode && (
        <p className="text-sm text-text-secondary">
          Código:{' '}
          <span className="font-mono font-semibold tracking-wide text-text-primary">
            {trackingCode}
          </span>
        </p>
      )}
      <ol className="relative space-y-0 border-l border-border pl-5">
        {visible.map((event, index) => {
          const done = Boolean(event.occurredAt)
          const label =
            TRACKING_EVENT_LABELS[event.eventType as TrackingEventType] ??
            event.eventType
          return (
            <li key={event.id ?? `${event.sequence}-${event.eventType}`} className="relative pb-5 last:pb-0">
              <span
                aria-hidden
                className={`absolute top-1 -left-[1.4rem] size-2.5 rounded-full ${
                  done ? 'bg-brand' : 'bg-border'
                }`}
              />
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className={`text-sm font-semibold ${done ? 'text-text-primary' : 'text-text-muted'}`}>
                  {label}
                  {event.isManual ? (
                    <span className="ml-2 text-[11px] font-medium text-text-muted">(manual)</span>
                  ) : null}
                </p>
                <time className="text-xs text-text-muted">
                  {event.occurredAt
                    ? formatDateTime(event.occurredAt)
                    : event.scheduledAt
                      ? `Previsto: ${formatDateTime(event.scheduledAt)}`
                      : null}
                </time>
              </div>
              <p className={`mt-1 text-sm ${done ? 'text-text-secondary' : 'text-text-muted'}`}>
                {event.message}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {event.city}/{event.state}
                {!done && index === visible.findIndex((item) => !item.occurredAt)
                  ? ' · Próxima atualização'
                  : ''}
              </p>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
