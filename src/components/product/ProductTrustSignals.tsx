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
    <ul className="grid grid-cols-1 gap-3 rounded-[1.35rem] bg-[#f6f3f8] px-4 py-4 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-[#e6dde8]">
      {items.map(({ key, label, Icon }) => (
        <li key={key} className="flex items-center gap-3 sm:px-4 sm:first:pl-1 sm:last:pr-1">
          <Icon className="size-6 shrink-0 text-[#3b1530]" strokeWidth={1.75} aria-hidden />
          <span className="text-[13px] font-medium leading-snug text-[#3b1530]">{label}</span>
        </li>
      ))}
    </ul>
  )
}
