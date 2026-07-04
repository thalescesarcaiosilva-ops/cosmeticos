import { splitInstallmentTemplate } from '@/lib/payment/format-installment'
import { formatCurrency } from '@/lib/products/format'
import type { InstallmentDisplay } from '@/types/payment'

type InstallmentLineProps = {
  display: InstallmentDisplay | null
  className?: string
  variant?: 'card' | 'product'
}

function renderInterestFreeText(text: string, interestFree: boolean, highlight: boolean) {
  if (!highlight || !interestFree) return text

  const lower = text.toLowerCase()
  const idx = lower.indexOf('sem juros')
  if (idx === -1) return text

  return (
    <>
      {text.slice(0, idx)}
      <span className="text-success">{text.slice(idx)}</span>
    </>
  )
}

export function InstallmentLine({
  display,
  className = '',
  variant = 'card',
}: InstallmentLineProps) {
  if (!display) return null

  const parts = splitInstallmentTemplate(display.template)
  const sizeClass = variant === 'product' ? 'text-sm' : 'text-[11px] md:text-xs'
  const highlightInterest = variant === 'product'

  return (
    <p
      className={`${sizeClass} text-text-secondary ${className}`}
      aria-label={display.label}
    >
      {parts.map((part, index) => {
        if (part.type === 'count') {
          return (
            <span key={index} className="font-bold text-text-primary">
              {display.count}
            </span>
          )
        }

        if (part.type === 'value') {
          return (
            <span key={index} className="font-bold text-text-primary">
              {formatCurrency(display.value)}
            </span>
          )
        }

        return (
          <span key={index}>
            {renderInterestFreeText(part.text, display.interestFree, highlightInterest)}
          </span>
        )
      })}
    </p>
  )
}
