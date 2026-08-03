import { MapPinned, RefreshCcw, ShieldCheck, Truck } from 'lucide-react'
import type { ProductPurchaseAssurances } from '@/types/product-assurances'

type ProductTrustSignalsProps = {
  assurances: ProductPurchaseAssurances
}

type TrustItem = {
  key: string
  label: string
  Icon: typeof RefreshCcw
}

function buildItems(assurances: ProductPurchaseAssurances): TrustItem[] {
  const items: TrustItem[] = []

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

export function ProductTrustSignals({ assurances }: ProductTrustSignalsProps) {
  const items = buildItems(assurances)
  if (items.length === 0) return null

  return (
    <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {items.map(({ key, label, Icon }) => (
        <li
          key={key}
          className="flex items-center gap-2.5 text-[12px] leading-snug text-text-secondary"
        >
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-strong text-brand">
            <Icon className="size-3.5" aria-hidden />
          </span>
          <span>{label}</span>
        </li>
      ))}
    </ul>
  )
}
