import Image from 'next/image'
import type { PaymentMethod } from '@/types/payment'

const CARD_METHOD_IDS = new Set(['visa', 'mastercard', 'elo', 'amex', 'american-express', 'diners', 'hipercard'])

type CheckoutPaymentBrandsProps = {
  methods: PaymentMethod[]
  variant?: 'card' | 'pix' | 'all'
  className?: string
}

function isCardMethod(method: PaymentMethod) {
  const id = method.id.toLowerCase()
  if (id === 'pix' || id === 'boleto') return false
  if (CARD_METHOD_IDS.has(id)) return true
  return !id.includes('pix') && !id.includes('boleto')
}

function isPixMethod(method: PaymentMethod) {
  return method.id.toLowerCase().includes('pix')
}

export function CheckoutPaymentBrands({
  methods,
  variant = 'all',
  className = '',
}: CheckoutPaymentBrandsProps) {
  const filtered = methods.filter((method) => {
    if (variant === 'card') return isCardMethod(method)
    if (variant === 'pix') return isPixMethod(method)
    return true
  })

  if (filtered.length === 0) return null

  return (
    <ul className={`flex flex-wrap items-center gap-2 ${className}`} aria-label="Formas de pagamento aceitas">
      {filtered.map((method) => (
        <li key={method.id}>
          {method.imageUrl ? (
            <span className="inline-flex h-6 items-center rounded border border-border bg-white px-2 py-0.5">
              <Image
                src={method.imageUrl}
                alt={method.label}
                width={40}
                height={24}
                className="h-4 w-auto max-w-[40px] object-contain"
              />
            </span>
          ) : (
            <span className="inline-flex h-6 items-center rounded border border-border bg-surface-muted px-2 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
              {method.label}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
