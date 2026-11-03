import { RefreshCcw, ShieldCheck, Truck } from 'lucide-react'
import type { ProductPurchaseAssurances } from '@/types/product-assurances'

type ProductTrustSignalsProps = {
  assurances: ProductPurchaseAssurances
  inStock: boolean
}

type TrustItem = {
  key: string
  label: string
  Icon: typeof RefreshCcw
}

function buildItems(assurances: ProductPurchaseAssurances, inStock: boolean): TrustItem[] {
  const items: TrustItem[] = []

  if (inStock) {
    items.push({
      key: 'shipping',
      Icon: Truck,
      label: 'Entrega garantida para todo o Brasil',
    })
  }

  if (assurances.returnEnabled && assurances.returnDays != null && assurances.returnDays > 0) {
    items.push({
      key: 'return',
      Icon: RefreshCcw,
      label: assurances.returnFree
        ? `Devolução grátis em até ${assurances.returnDays} dias`
        : `Troca ou devolução em até ${assurances.returnDays} dias`,
    })
  }

  if (assurances.pixEnabled || assurances.cardEnabled) {
    const parts: string[] = []
    if (assurances.pixEnabled) parts.push('Pix')
    if (assurances.cardEnabled) parts.push('cartão')
    items.push({
      key: 'payment',
      Icon: ShieldCheck,
      label: `Pagamento seguro com ${parts.join(' e ')}`,
    })
  }

  return items
}

export function ProductTrustSignals({ assurances, inStock }: ProductTrustSignalsProps) {
  const items = buildItems(assurances, inStock)
  if (items.length === 0) return null

  return (
    <ul className="grid grid-cols-1 gap-3 rounded-2xl bg-[#f7f3f4] px-4 py-3.5 sm:grid-cols-3 sm:gap-3">
      {items.map(({ key, label, Icon }) => (
        <li key={key} className="flex min-w-0 items-center gap-2.5">
          <Icon className="size-5 shrink-0 text-text-primary" strokeWidth={1.75} aria-hidden />
          <span className="text-[12.5px] leading-snug text-text-primary">{label}</span>
        </li>
      ))}
    </ul>
  )
}
