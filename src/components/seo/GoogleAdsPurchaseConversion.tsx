'use client'

import { useEffect, useRef } from 'react'
import { fireGoogleAdsConversion, normalizeAdsSendTo } from '@/lib/seo/analytics'

type GoogleAdsPurchaseConversionProps = {
  orderId: string
  /** Total do pedido em reais (mesmo valor cobrado). */
  value: number
  /** Só dispara quando true (pagamento confirmado). */
  paid: boolean
  /** send_to do admin: AW-XXXX/label */
  sendTo: string | null | undefined
}

/**
 * Conversão Google Ads "Compra" — só com pedido pago,
 * com value e transaction_id reais (evita deturpação e duplicata).
 */
export function GoogleAdsPurchaseConversion({
  orderId,
  value,
  paid,
  sendTo,
}: GoogleAdsPurchaseConversionProps) {
  const startedRef = useRef(false)
  const normalizedSendTo = normalizeAdsSendTo(sendTo)

  useEffect(() => {
    if (!paid || !normalizedSendTo || startedRef.current) return
    startedRef.current = true
    fireGoogleAdsConversion({
      sendTo: normalizedSendTo,
      value,
      transactionId: orderId,
    })
  }, [paid, orderId, value, normalizedSendTo])

  return null
}
