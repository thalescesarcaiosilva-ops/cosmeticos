import { TRACKING_ORIGIN, type PlannedTrackingEvent, type TrackingHub } from './types'

const HUBS_BY_UF: Record<string, TrackingHub[]> = {
  AC: [
    { city: 'Brasília', state: 'DF' },
    { city: 'Porto Velho', state: 'RO' },
    { city: 'Rio Branco', state: 'AC' },
  ],
  AL: [
    { city: 'Aracaju', state: 'SE' },
    { city: 'Maceió', state: 'AL' },
  ],
  AP: [
    { city: 'Brasília', state: 'DF' },
    { city: 'Belém', state: 'PA' },
    { city: 'Macapá', state: 'AP' },
  ],
  AM: [
    { city: 'Brasília', state: 'DF' },
    { city: 'Manaus', state: 'AM' },
  ],
  BA: [{ city: 'Feira de Santana', state: 'BA' }],
  CE: [
    { city: 'Recife', state: 'PE' },
    { city: 'Fortaleza', state: 'CE' },
  ],
  DF: [
    { city: 'Feira de Santana', state: 'BA' },
    { city: 'Brasília', state: 'DF' },
  ],
  ES: [
    { city: 'Feira de Santana', state: 'BA' },
    { city: 'Vitória', state: 'ES' },
  ],
  GO: [
    { city: 'Feira de Santana', state: 'BA' },
    { city: 'Brasília', state: 'DF' },
    { city: 'Goiânia', state: 'GO' },
  ],
  MA: [
    { city: 'Fortaleza', state: 'CE' },
    { city: 'São Luís', state: 'MA' },
  ],
  MT: [
    { city: 'Brasília', state: 'DF' },
    { city: 'Cuiabá', state: 'MT' },
  ],
  MS: [
    { city: 'Brasília', state: 'DF' },
    { city: 'Campo Grande', state: 'MS' },
  ],
  MG: [
    { city: 'Feira de Santana', state: 'BA' },
    { city: 'Belo Horizonte', state: 'MG' },
  ],
  PA: [
    { city: 'Brasília', state: 'DF' },
    { city: 'Belém', state: 'PA' },
  ],
  PB: [
    { city: 'Recife', state: 'PE' },
    { city: 'João Pessoa', state: 'PB' },
  ],
  PR: [
    { city: 'Feira de Santana', state: 'BA' },
    { city: 'Belo Horizonte', state: 'MG' },
    { city: 'São Paulo', state: 'SP' },
    { city: 'Curitiba', state: 'PR' },
  ],
  PE: [
    { city: 'Feira de Santana', state: 'BA' },
    { city: 'Recife', state: 'PE' },
  ],
  PI: [{ city: 'Teresina', state: 'PI' }],
  RJ: [
    { city: 'Feira de Santana', state: 'BA' },
    { city: 'Belo Horizonte', state: 'MG' },
    { city: 'Rio de Janeiro', state: 'RJ' },
  ],
  RN: [
    { city: 'Recife', state: 'PE' },
    { city: 'Natal', state: 'RN' },
  ],
  RS: [
    { city: 'Feira de Santana', state: 'BA' },
    { city: 'São Paulo', state: 'SP' },
    { city: 'Curitiba', state: 'PR' },
    { city: 'Porto Alegre', state: 'RS' },
  ],
  RO: [
    { city: 'Brasília', state: 'DF' },
    { city: 'Porto Velho', state: 'RO' },
  ],
  RR: [
    { city: 'Brasília', state: 'DF' },
    { city: 'Manaus', state: 'AM' },
    { city: 'Boa Vista', state: 'RR' },
  ],
  SC: [
    { city: 'Feira de Santana', state: 'BA' },
    { city: 'São Paulo', state: 'SP' },
    { city: 'Florianópolis', state: 'SC' },
  ],
  SP: [
    { city: 'Feira de Santana', state: 'BA' },
    { city: 'Belo Horizonte', state: 'MG' },
    { city: 'Campinas', state: 'SP' },
  ],
  SE: [{ city: 'Aracaju', state: 'SE' }],
  TO: [
    { city: 'Brasília', state: 'DF' },
    { city: 'Palmas', state: 'TO' },
  ],
}

function normalizeCity(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase()
}

function samePlace(a: TrackingHub, b: TrackingHub): boolean {
  return (
    normalizeCity(a.city) === normalizeCity(b.city) &&
    a.state.toUpperCase() === b.state.toUpperCase()
  )
}

function placeLabel(hub: TrackingHub): string {
  return `${hub.city}/${hub.state.toUpperCase()}`
}

/** Agenda horário aproximado em BRT (UTC-3). */
function atBrazilTime(from: Date, dayOffset: number, hour: number, minute = 0): Date {
  const base = new Date(from.getTime() + dayOffset * 24 * 60 * 60 * 1000)
  const year = base.getUTCFullYear()
  const month = base.getUTCMonth()
  const day = base.getUTCDate()
  return new Date(Date.UTC(year, month, day, hour + 3, minute, 0, 0))
}

function trimHubs(
  hubs: TrackingHub[],
  maxHubs: number,
  destination: TrackingHub
): TrackingHub[] {
  const filtered = hubs.filter(
    (hub) => !samePlace(hub, destination) && !samePlace(hub, TRACKING_ORIGIN)
  )
  if (filtered.length <= maxHubs) return filtered
  if (maxHubs <= 0) return []
  if (maxHubs === 1) return [filtered[filtered.length - 1]!]

  const first = filtered[0]!
  const last = filtered[filtered.length - 1]!
  if (maxHubs === 2) return samePlace(first, last) ? [first] : [first, last]

  const middle = filtered.slice(1, -1)
  const step = Math.max(1, Math.floor(middle.length / (maxHubs - 2)))
  const picked = [first]
  for (let i = 0; i < middle.length && picked.length < maxHubs - 1; i += step) {
    picked.push(middle[i]!)
  }
  if (!samePlace(picked[picked.length - 1]!, last)) picked.push(last)
  return picked.slice(0, maxHubs)
}

export function resolveHubsForDestination(
  destination: TrackingHub,
  transitDays: number
): TrackingHub[] {
  const uf = destination.state.toUpperCase()
  const corridor = HUBS_BY_UF[uf] ?? [
    { city: 'Feira de Santana', state: 'BA' },
    { city: 'Brasília', state: 'DF' },
  ]

  const maxHubs = Math.max(0, Math.min(corridor.length, transitDays - 1))
  return trimHubs(corridor, maxHubs, destination)
}

export function buildTrackingRoute(params: {
  destinationCity: string
  destinationState: string
  shippedAt?: Date
  estimatedDaysMin?: number | null
  estimatedDaysMax?: number | null
}): PlannedTrackingEvent[] {
  const shippedAt = params.shippedAt ?? new Date()
  const destination: TrackingHub = {
    city: params.destinationCity.trim() || 'Destino',
    state: (params.destinationState || 'BA').toUpperCase().slice(0, 2),
  }

  const minDays = Math.max(2, Number(params.estimatedDaysMin ?? 5))
  const maxDays = Math.max(minDays, Number(params.estimatedDaysMax ?? minDays))
  const transitDays = Math.max(2, Math.round((minDays + maxDays) / 2))

  const localDelivery = samePlace(destination, TRACKING_ORIGIN)
  const hubs = localDelivery ? [] : resolveHubsForDestination(destination, transitDays)

  const events: PlannedTrackingEvent[] = []
  let sequence = 1

  events.push({
    sequence: sequence++,
    eventType: 'packed',
    city: TRACKING_ORIGIN.city,
    state: TRACKING_ORIGIN.state,
    message: `Pedido embalado em ${placeLabel(TRACKING_ORIGIN)}`,
    scheduledAt: atBrazilTime(shippedAt, 0, 9),
    occurImmediately: true,
  })

  events.push({
    sequence: sequence++,
    eventType: 'departed',
    city: TRACKING_ORIGIN.city,
    state: TRACKING_ORIGIN.state,
    message: `Objeto saiu do centro de distribuição de ${placeLabel(TRACKING_ORIGIN)}`,
    scheduledAt: atBrazilTime(shippedAt, 0, 11),
    occurImmediately: true,
  })

  let day = 1
  for (const hub of hubs) {
    events.push({
      sequence: sequence++,
      eventType: 'in_transit',
      city: hub.city,
      state: hub.state,
      message: `Em transporte para ${placeLabel(hub)}`,
      scheduledAt: atBrazilTime(shippedAt, day, 10),
    })
    events.push({
      sequence: sequence++,
      eventType: 'arrived_hub',
      city: hub.city,
      state: hub.state,
      message: `Chegou ao centro de distribuição de ${placeLabel(hub)}`,
      scheduledAt: atBrazilTime(shippedAt, day, 16),
    })
    day += 1
  }

  const deliveryDay = Math.max(day, localDelivery ? 1 : day)
  events.push({
    sequence: sequence++,
    eventType: 'in_transit',
    city: destination.city,
    state: destination.state,
    message: `Em transporte para ${placeLabel(destination)}`,
    scheduledAt: atBrazilTime(shippedAt, deliveryDay, 10),
  })
  events.push({
    sequence: sequence++,
    eventType: 'out_for_delivery',
    city: destination.city,
    state: destination.state,
    message: `Saiu para entrega em ${placeLabel(destination)}`,
    scheduledAt: atBrazilTime(shippedAt, deliveryDay, 14),
  })
  events.push({
    sequence: sequence++,
    eventType: 'delivered',
    city: destination.city,
    state: destination.state,
    message: `Objeto entregue em ${placeLabel(destination)}`,
    scheduledAt: atBrazilTime(shippedAt, deliveryDay, 18),
  })

  return events
}
