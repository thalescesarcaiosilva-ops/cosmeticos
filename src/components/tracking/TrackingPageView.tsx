'use client'

import { useEffect, useMemo, useState, useEffectEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  CalendarDays,
  Check,
  Headphones,
  Info,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { fetchApi } from '@/lib/api/fetch-api'
import type { PublicTrackingResult } from '@/lib/tracking/queries'

const TRACKING_PATH = '/paginas/rastreio'

type MacroStepKey =
  | 'ordered'
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'

type MacroStep = {
  key: MacroStepKey
  label: string
  icon: 'check' | 'truck' | 'package' | 'pin' | 'done'
}

const MACRO_STEPS: MacroStep[] = [
  { key: 'ordered', label: 'Pedido realizado', icon: 'check' },
  { key: 'shipped', label: 'Despachado', icon: 'truck' },
  { key: 'in_transit', label: 'Em trânsito', icon: 'package' },
  { key: 'out_for_delivery', label: 'Saiu para entrega', icon: 'pin' },
  { key: 'delivered', label: 'Entregue', icon: 'done' },
]

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return null
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function resolveActiveMacroIndex(result: PublicTrackingResult): number {
  if (result.status === 'delivered' || result.deliveredAt) return 4
  const types = new Set(result.events.map((event) => event.eventType))
  if (types.has('out_for_delivery')) return 3
  if (types.has('in_transit') || types.has('arrived_hub')) return 2
  if (types.has('departed') || types.has('packed') || result.shippedAt) return 1
  return 0
}

function stepDate(
  result: PublicTrackingResult,
  key: MacroStepKey
): string | null {
  const byType = (type: string) =>
    result.events.find((event) => event.eventType === type && event.occurredAt)
      ?.occurredAt ?? null

  switch (key) {
    case 'ordered':
      return byType('packed') ?? result.shippedAt
    case 'shipped':
      return byType('departed') ?? byType('packed') ?? result.shippedAt
    case 'in_transit':
      return (
        [...result.events]
          .reverse()
          .find(
            (event) =>
              (event.eventType === 'in_transit' ||
                event.eventType === 'arrived_hub') &&
              event.occurredAt
          )?.occurredAt ?? null
      )
    case 'out_for_delivery':
      return byType('out_for_delivery')
    case 'delivered':
      return byType('delivered') ?? result.deliveredAt
    default:
      return null
  }
}

function StepIcon({
  icon,
  active,
}: {
  icon: MacroStep['icon']
  active: boolean
}) {
  const className = `size-5 ${active ? 'text-white' : 'text-text-muted'}`
  if (icon === 'truck') return <Truck className={className} aria-hidden />
  if (icon === 'package') return <Package className={className} aria-hidden />
  if (icon === 'pin') return <MapPin className={className} aria-hidden />
  if (icon === 'done') return <Check className={className} strokeWidth={3} aria-hidden />
  return <Check className={className} strokeWidth={3} aria-hidden />
}

function TrackingResultCard({ result }: { result: PublicTrackingResult }) {
  const activeIndex = resolveActiveMacroIndex(result)
  const shippedLabel = formatDateTime(result.shippedAt)

  const steps = useMemo(
    () =>
      MACRO_STEPS.map((step, index) => {
        const done = index <= activeIndex
        const date = done ? formatDateTime(stepDate(result, step.key)) : null
        return { ...step, done, date }
      }),
    [result, activeIndex]
  )

  return (
    <section className="mx-auto mt-8 max-w-4xl rounded-2xl border border-border bg-white p-5 shadow-sm md:p-8">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Package className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-text-primary">
              Pedido{' '}
              <span className="font-mono tracking-wide text-brand">
                {result.trackingCode}
              </span>
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              Transportadora: {result.carrier || 'Batista Logística'}
            </p>
          </div>
        </div>
        {shippedLabel && (
          <div className="flex items-center gap-2 text-sm text-text-secondary sm:justify-end">
            <CalendarDays className="size-4 text-brand" aria-hidden />
            <span>Data do despacho: {shippedLabel}</span>
          </div>
        )}
      </div>

      <ol className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-5 md:gap-2">
        {steps.map((step, index) => (
          <li key={step.key} className="relative flex flex-col items-center text-center">
            {index < steps.length - 1 && (
              <span
                aria-hidden
                className={`absolute top-5 left-[calc(50%+22px)] hidden h-0.5 w-[calc(100%-20px)] md:block ${
                  index < activeIndex ? 'bg-brand' : 'bg-border'
                }`}
              />
            )}
            <span
              className={`relative z-[1] flex size-10 items-center justify-center rounded-full ${
                step.done
                  ? 'bg-brand text-white shadow-[0_0_0_6px_rgba(216,100,135,0.15)]'
                  : 'bg-surface-muted text-text-muted'
              }`}
            >
              <StepIcon icon={step.icon} active={step.done} />
            </span>
            <p
              className={`mt-3 text-sm font-semibold ${
                step.done ? 'text-text-primary' : 'text-text-muted'
              }`}
            >
              {step.label}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {step.done
                ? step.date || 'Atualizado'
                : 'Aguardando atualização'}
            </p>
          </li>
        ))}
      </ol>

      {result.events.length > 0 && (
        <div className="mt-8 border-t border-border pt-6">
          <h2 className="text-sm font-semibold text-text-primary">
            Histórico de movimentações
          </h2>
          <ol className="mt-4 space-y-4 border-l border-border pl-5">
            {[...result.events]
              .sort((a, b) => b.sequence - a.sequence)
              .map((event) => (
                <li key={event.id} className="relative">
                  <span
                    aria-hidden
                    className="absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full bg-brand"
                  />
                  <p className="text-sm font-medium text-text-primary">
                    {event.message}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {event.city}/{event.state}
                    {event.occurredAt
                      ? ` · ${formatDateTime(event.occurredAt)}`
                      : ''}
                  </p>
                </li>
              ))}
          </ol>
        </div>
      )}

      <div className="mt-8 flex items-start gap-3 rounded-xl bg-brand/5 px-4 py-3 text-sm text-text-secondary">
        <Info className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
        <p>
          As informações de rastreamento podem levar algumas horas para serem
          atualizadas pela transportadora.
        </p>
      </div>
    </section>
  )
}

const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    title: 'Compra 100% segura',
    subtitle: 'Seus dados protegidos',
  },
  {
    icon: Truck,
    title: 'Entrega para todo o Brasil',
    subtitle: 'Com rastreamento',
  },
  {
    icon: Package,
    title: 'Atualizações em tempo real',
    subtitle: 'Acompanhe cada etapa',
  },
  {
    icon: Headphones,
    title: 'Dúvidas? Estamos aqui',
    subtitle: 'Atendimento humanizado',
  },
] as const

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
    router.replace(
      `${TRACKING_PATH}?codigo=${encodeURIComponent(data.trackingCode)}`
    )
  })

  useEffect(() => {
    if (initialCode.trim()) {
      void lookup(initialCode)
    }
  }, [initialCode])

  return (
    <div className="pb-16">
      <section className="relative overflow-hidden border-b border-brand/10 bg-[linear-gradient(180deg,#fdf7f6_0%,#ffffff_70%)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 12% 20%, rgba(216,100,135,0.18), transparent 42%), radial-gradient(circle at 88% 18%, rgba(216,100,135,0.14), transparent 40%), radial-gradient(circle at 70% 90%, rgba(74,32,42,0.06), transparent 45%)',
          }}
        />
        <div className="relative mx-auto max-w-3xl px-4 pb-10 pt-12 text-center md:pb-12 md:pt-16">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
            Rastreio
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
            Acompanhe seu pedido
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-text-secondary md:text-base">
            Digite o código recebido por e-mail após o despacho do pedido.
          </p>

          <form
            className="mx-auto mt-8 flex max-w-xl overflow-hidden rounded-full border border-border bg-white shadow-sm focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20"
            onSubmit={(event) => {
              event.preventDefault()
              void lookup(code)
            }}
          >
            <span className="flex items-center bg-brand/10 px-4 text-brand">
              <Package className="size-5" aria-hidden />
            </span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="Ex.: BC482917365BR"
              aria-label="Código de rastreio"
              className="min-w-0 flex-1 border-0 bg-transparent px-3 py-3.5 font-mono text-sm tracking-wide text-text-primary outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-text-muted"
            />
            <button
              type="submit"
              disabled={loading}
              className="m-1.5 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <Search className="size-4" aria-hidden />
              {loading ? 'Consultando…' : 'Rastrear'}
            </button>
          </form>
        </div>
      </section>

      <section className="border-b border-border bg-white">
        <ul className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {TRUST_ITEMS.map((item) => (
            <li key={item.title} className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                <item.icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                <p className="text-xs text-text-secondary">{item.subtitle}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="mx-auto max-w-4xl px-4">
        {error && (
          <div className="mt-6">
            <Alert type="error">{error}</Alert>
          </div>
        )}
        {result && <TrackingResultCard result={result} />}
      </div>
    </div>
  )
}
