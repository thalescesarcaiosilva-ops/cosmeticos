import type { PaymentMethod, PaymentMethodIcon } from '@/types/payment'

export function buildPaymentMethodIcons(methods: PaymentMethod[]): PaymentMethodIcon[] {
  return methods.flatMap((method) => {
    const imageUrl = method.imageUrl?.trim()
    if (!imageUrl) return []
    return [{ id: method.id, label: method.label, imageUrl }]
  })
}
