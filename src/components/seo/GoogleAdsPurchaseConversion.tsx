'use client'

import { useEffect, useRef } from 'react'
import { trackGoogleAdsPurchase } from '@/lib/seo/google-ads-conversion'

type GoogleAdsPurchaseConversionProps = {
  orderId: string
  /** Total do pedido em reais (mesmo valor cobrado). */
  value: number
  /** Só dispara quando true (pagamento confirmado). */
  paid: boolean
}

/**
 * Dispara a conversão Google Ads "Compra" apenas com pedido pago,
 * com value e transaction_id reais (evita deturpação e duplicata).
 */
export function GoogleAdsPurchaseConversion({
  orderId,
  value,
  paid,
}: GoogleAdsPurchaseConversionProps) {
  const firedRef = useRef(false)

  useEffect(() => {
    if (!paid || firedRef.current) return
    firedRef.current = true
    trackGoogleAdsPurchase({ orderId, value })
  }, [paid, orderId, value])

  return null
}
