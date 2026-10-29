import { Fragment } from 'react'
import { RefreshCcw, ShieldCheck } from 'lucide-react'
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
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {items.map(({ key, label, Icon }, index) => (
        <Fragment key={key}>
          {index > 0 ? <li className="hidden h-4 w-px bg-border sm:block" aria-hidden /> : null}
          <li className="flex items-center gap-2 text-[13px] leading-snug text-text-secondary">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
              <Icon className="size-3.5" aria-hidden />
            </span>
            <span>{label}</span>
          </li>
        </Fragment>
      ))}
    </ul>
  )
}
