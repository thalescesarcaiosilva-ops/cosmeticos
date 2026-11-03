import {
  calcQuantityPackQuote,
  getQuantityDiscountPercent,
} from '@/lib/products/quantity-packs'
import type { ValidatedCartLine } from '@/types/cart'

/**
 * Aplica desconto por quantidade na mesma linha (2 = 5%, 3+ = 10%).
 * Deve rodar depois do Compre Junto para compor `displayLineTotal`
 * sem sobrescrever o desconto de pares.
 */
export function applyQuantityDiscountsToLines(lines: ValidatedCartLine[]): {
  quantityDiscountAmount: number
  lines: ValidatedCartLine[]
} {
  let quantityDiscountAmount = 0

  const updated = lines.map((line) => {
    const bundleDiscount = line.bundleDiscountAmount ?? 0

    if (!line.available || line.quantity <= 0) {
      return {
        ...line,
        quantityDiscountAmount: 0,
        quantityDiscountPercent: 0,
        displayLineTotal: Math.max(line.lineTotal - bundleDiscount, 0),
      }
    }

    const discountPercent = getQuantityDiscountPercent(line.quantity)
    if (discountPercent <= 0) {
      return {
        ...line,
        quantityDiscountAmount: 0,
        quantityDiscountPercent: 0,
        displayLineTotal: Math.max(line.lineTotal - bundleDiscount, 0),
      }
    }

    const quote = calcQuantityPackQuote(line.price, line.quantity, discountPercent)
    quantityDiscountAmount += quote.savings

    return {
      ...line,
      quantityDiscountAmount: quote.savings,
      quantityDiscountPercent: discountPercent,
      displayLineTotal: Math.max(line.lineTotal - quote.savings - bundleDiscount, 0),
    }
  })

  return {
    quantityDiscountAmount: Math.round(quantityDiscountAmount * 100) / 100,
    lines: updated,
  }
}
