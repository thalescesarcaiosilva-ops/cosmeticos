'use client'

import { useEffect, useState, useEffectEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PackageSearch } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { TrackingTimeline } from '@/components/tracking/TrackingTimeline'
import { fetchApi } from '@/lib/api/fetch-api'
import type { PublicTrackingResult } from '@/lib/tracking/queries'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Aguardando pagamento',
  confirmed: 'Confirmado',
  shipped: 'Em trânsito',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}

export function TrackingPageView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialCode = searchParams.get('codigo') ?? searchParams.get('code') ?? ''

  const [code, setCode] = useState(initialCode)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PublicTrackingResult | null>(null)

  const lookup = useEffectEvent(async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setError('Informe o código de rastreio')
      setResult(null)
      return
    }

    setLoading(true)
    setError(null)
    const { data, error: apiError } = await fetchApi<PublicTrackingResult>(
      `/api/tracking?code=${encodeURIComponent(trimmed)}`
    )
    setLoading(false)

    if (apiError || !data) {
      setResult(null)
      setError(apiError ?? 'Código não encontrado')
      return
    }

    setResult(data)
    router.replace(`/rastreio?codigo=${encodeURIComponent(data.trackingCode)}`)
  })

  useEffect(() => {
    if (initialCode.trim()) {
      void lookup(initialCode)
    }
  }, [initialCode])

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 md:py-14">
      <div className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
          Rastreio
        </p>
        <h1 className="text-3xl font-bold text-text-primary">Acompanhe seu pedido</h1>
        <p className="text-sm text-text-secondary">
          Digite o código recebido por e-mail após o despacho do pedido.
        </p>
      </div>

      <Card>
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-start"
          onSubmit={(event) => {
            event.preventDefault()
            void lookup(code)
          }}
        >
          <div className="min-w-0 flex-1">
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="Ex.: BC482917365BR"
              aria-label="Código de rastreio"
              className="font-mono tracking-wide"
            />
          </div>
          <Button type="submit" disabled={loading} className="gap-2 sm:shrink-0">
            <PackageSearch className="size-4" aria-hidden />
            {loading ? 'Consultando…' : 'Rastrear'}
          </Button>
        </form>
      </Card>

      {error && <Alert type="error">{error}</Alert>}

      {result && (
        <Card className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Status atual
              </p>
              <p className="mt-1 text-lg font-semibold text-text-primary">
                {STATUS_LABELS[result.status] ?? result.status}
              </p>
              {result.destinationCity && (
                <p className="mt-1 text-sm text-text-secondary">
                  Destino: {result.destinationCity}
                  {result.destinationState ? `/${result.destinationState}` : ''}
                </p>
              )}
            </div>
            {result.carrier && (
              <p className="text-xs text-text-muted">{result.carrier}</p>
            )}
          </div>

          <TrackingTimeline
            trackingCode={result.trackingCode}
            events={result.events.map((event) => ({
              id: event.id,
              sequence: event.sequence,
              eventType: event.eventType,
              city: event.city,
              state: event.state,
              message: event.message,
              scheduledAt: event.scheduledAt,
              occurredAt: event.occurredAt,
              isManual: event.isManual,
            }))}
          />
        </Card>
      )}
    </div>
  )
}
