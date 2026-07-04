import { calcInstallmentDisplay } from '@/lib/payment/installments'
import type { InstallmentDisplay, PaymentSettings } from '@/types/payment'
import type { ProductCardData } from '@/types/product'

export function buildInstallmentMap(
  products: ProductCardData[],
  settings: PaymentSettings
): Map<string, InstallmentDisplay | null> {
  const map = new Map<string, InstallmentDisplay | null>()
  for (const product of products) {
    map.set(product.id, calcInstallmentDisplay(product.price, settings))
  }
  return map
}
