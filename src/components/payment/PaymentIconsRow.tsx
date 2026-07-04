import Image from 'next/image'
import type { PaymentMethodIcon } from '@/types/payment'

type PaymentIconsRowProps = {
  icons: PaymentMethodIcon[]
  size?: 'sm' | 'md'
  className?: string
}

export function PaymentIconsRow({ icons, size = 'md', className = '' }: PaymentIconsRowProps) {
  if (icons.length === 0) return null

  const height = size === 'sm' ? 'h-6' : 'h-8'

  return (
    <ul className={`flex flex-wrap items-center gap-2 ${className}`} aria-label="Formas de pagamento">
      {icons.map((icon) => (
        <li key={icon.id} className="inline-flex">
          <Image
            src={icon.imageUrl}
            alt={icon.label}
            width={80}
            height={32}
            className={`${height} w-auto max-w-[72px] object-contain`}
          />
        </li>
      ))}
    </ul>
  )
}
