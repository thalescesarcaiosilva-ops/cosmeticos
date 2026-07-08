import type { StoreOpeningHoursSlot } from '@/schemas/store-profile-schema'
import type { StoreProfile } from '@/lib/store-profile/queries'

const DAY_LABELS: Record<string, string> = {
  Monday: 'Seg',
  Tuesday: 'Ter',
  Wednesday: 'Qua',
  Thursday: 'Qui',
  Friday: 'Sex',
  Saturday: 'Sáb',
  Sunday: 'Dom',
}

export function formatStoreAddress(profile: Pick<
  StoreProfile,
  | 'store_street'
  | 'store_street_number'
  | 'store_complement'
  | 'store_neighborhood'
  | 'store_city'
  | 'store_state'
  | 'store_postal_code'
>): string | null {
  const line1 = [profile.store_street, profile.store_street_number].filter(Boolean).join(', ')
  const line2 = profile.store_complement
  const line3 = profile.store_neighborhood
  const line4 =
    profile.store_city && profile.store_state
      ? `${profile.store_city}/${profile.store_state}`
      : profile.store_city
  const line5 = profile.store_postal_code ? `CEP ${profile.store_postal_code}` : null

  const lines = [line1, line2, line3, line4, line5].filter(Boolean)
  return lines.length > 0 ? lines.join('\n') : null
}

export function formatOpeningHours(slots: StoreOpeningHoursSlot[]): string | null {
  if (slots.length === 0) return null

  return slots
    .map((slot) => {
      const days = Array.isArray(slot.dayOfWeek)
        ? slot.dayOfWeek.map((d) => DAY_LABELS[d] ?? d).join(', ')
        : (DAY_LABELS[slot.dayOfWeek] ?? slot.dayOfWeek)
      return `${days}: ${slot.opens}–${slot.closes}`
    })
    .join(' · ')
}

const FULL_DAY_LABELS: Record<string, string> = {
  Monday: 'Segunda-feira',
  Tuesday: 'Terça-feira',
  Wednesday: 'Quarta-feira',
  Thursday: 'Quinta-feira',
  Friday: 'Sexta-feira',
  Saturday: 'Sábado',
  Sunday: 'Domingo',
}

function formatDayRange(days: string[]): string {
  if (days.length === 0) return ''
  if (days.length === 1) return FULL_DAY_LABELS[days[0]!] ?? days[0]!

  const order = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ]
  const sorted = [...days].sort((a, b) => order.indexOf(a) - order.indexOf(b))
  const indices = sorted.map((d) => order.indexOf(d))

  let isConsecutive = true
  for (let i = 1; i < indices.length; i++) {
    if (indices[i]! - indices[i - 1]! !== 1) {
      isConsecutive = false
      break
    }
  }

  if (isConsecutive && sorted.length > 1) {
    return `${FULL_DAY_LABELS[sorted[0]!] ?? sorted[0]} a ${FULL_DAY_LABELS[sorted[sorted.length - 1]!] ?? sorted[sorted.length - 1]}`
  }

  return sorted.map((d) => FULL_DAY_LABELS[d] ?? d).join(', ')
}

function formatHour(time: string): string {
  const normalized = time.trim()
  if (!normalized) return ''
  if (/^\d{2}:\d{2}$/.test(normalized)) {
    return `${normalized}h`
  }
  return normalized
}

export function formatOpeningHoursLong(slots: StoreOpeningHoursSlot[]): string | null {
  if (slots.length === 0) return null

  const lines = slots.map((slot) => {
    const days = Array.isArray(slot.dayOfWeek) ? slot.dayOfWeek : [slot.dayOfWeek]
    const dayLabel = formatDayRange(days)
    return `${dayLabel}: ${formatHour(slot.opens)} às ${formatHour(slot.closes)}`
  })

  return `${lines.join('. ')}. Exceto feriados`
}

export function formatStoreAddressInline(
  profile: Pick<
    StoreProfile,
    | 'store_street'
    | 'store_street_number'
    | 'store_complement'
    | 'store_neighborhood'
    | 'store_city'
    | 'store_state'
    | 'store_postal_code'
  >
): string | null {
  const streetParts = [
    profile.store_street?.trim(),
    profile.store_street_number?.trim(),
    profile.store_complement?.trim(),
  ].filter(Boolean)

  const neighborhood = profile.store_neighborhood?.trim()
  const cityState =
    profile.store_city?.trim() && profile.store_state?.trim()
      ? `${profile.store_city.trim()}/${profile.store_state.trim()}`
      : (profile.store_city?.trim() ?? null)

  const parts = [
    streetParts.length > 0 ? streetParts.join(', ') : null,
    neighborhood,
    cityState,
    profile.store_postal_code?.trim()
      ? `CEP ${profile.store_postal_code.trim()}`
      : null,
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(', ') : null
}

export function formatPhoneDisplay(areaCode: string, number: string): string | null {
  const digits = `${areaCode}${number}`.replace(/\D/g, '')
  if (digits.length < 10) return digits || null

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }

  return digits
}
