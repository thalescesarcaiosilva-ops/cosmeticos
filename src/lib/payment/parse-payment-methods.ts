import {
  DEFAULT_PAYMENT_SETTINGS,
  PAYMENT_METHOD_SUGGESTIONS,
  type PaymentMethod,
} from '@/types/payment'

type PaymentMethodsRow = {
  payment_methods_config?: unknown
  payment_methods?: unknown
  payment_method_images?: unknown
}

const SUGGESTION_LABELS = new Map(PAYMENT_METHOD_SUGGESTIONS.map((option) => [option.id, option.label]))

export function slugifyPaymentMethod(label: string): string {
  const slug = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || `pagamento-${Date.now()}`
}

function dedupePaymentMethods(methods: PaymentMethod[]): PaymentMethod[] {
  const seen = new Set<string>()

  return methods.map((method) => {
    let id = method.id
    let suffix = 2
    while (seen.has(id)) {
      id = `${method.id}-${suffix++}`
    }
    seen.add(id)
    return { ...method, id }
  })
}

export function parsePaymentMethodImages(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

  const images: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' && value.trim()) {
      images[key.trim()] = value.trim()
    }
  }
  return images
}

function readImageUrl(item: Record<string, unknown>): string | null {
  const camel =
    typeof item.imageUrl === 'string' && item.imageUrl.trim() ? item.imageUrl.trim() : null
  const snake =
    typeof item.image_url === 'string' && item.image_url.trim() ? item.image_url.trim() : null
  return camel ?? snake
}

function parseConfigArray(raw: unknown): PaymentMethod[] {
  if (!Array.isArray(raw)) return []

  const methods: PaymentMethod[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue

    const record = item as Record<string, unknown>
    const label = typeof record.label === 'string' ? record.label.trim() : ''
    if (!label) continue

    const id =
      typeof record.id === 'string' && record.id.trim()
        ? record.id.trim()
        : slugifyPaymentMethod(label)

    methods.push({ id, label, imageUrl: readImageUrl(record) })
  }

  return dedupePaymentMethods(methods)
}

function parseLegacy(row: PaymentMethodsRow): PaymentMethod[] {
  const ids = Array.isArray(row.payment_methods)
    ? row.payment_methods.filter(
        (id): id is string => typeof id === 'string' && id.trim().length > 0
      )
    : []

  const images = parsePaymentMethodImages(row.payment_method_images)

  return ids.map((id) => ({
    id,
    label: SUGGESTION_LABELS.get(id) ?? id,
    imageUrl: images[id] ?? null,
  }))
}

function mergeMethodImages(
  methods: PaymentMethod[],
  imageMap: Record<string, string>
): PaymentMethod[] {
  return methods.map((method) => ({
    ...method,
    imageUrl: method.imageUrl || imageMap[method.id] || null,
  }))
}

export function parsePaymentMethods(row: PaymentMethodsRow): PaymentMethod[] {
  const imageMap = parsePaymentMethodImages(row.payment_method_images)
  const fromConfig = parseConfigArray(row.payment_methods_config)

  if (fromConfig.length > 0) {
    return mergeMethodImages(fromConfig, imageMap)
  }

  const legacy = parseLegacy(row)
  if (legacy.length > 0) {
    return mergeMethodImages(legacy, imageMap)
  }

  return DEFAULT_PAYMENT_SETTINGS.paymentMethods
}

export function normalizePaymentMethodsForSave(methods: PaymentMethod[]): PaymentMethod[] {
  return dedupePaymentMethods(
    methods
      .filter((method) => method.label.trim())
      .map((method) => ({
        id: method.id.trim() || slugifyPaymentMethod(method.label),
        label: method.label.trim(),
        imageUrl: method.imageUrl?.trim() || null,
      }))
  )
}

export function serializePaymentMethodsConfig(methods: PaymentMethod[]) {
  return normalizePaymentMethodsForSave(methods).map((method) => ({
    id: method.id,
    label: method.label,
    imageUrl: method.imageUrl,
  }))
}
