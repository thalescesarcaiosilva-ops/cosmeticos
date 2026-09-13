'use client'

import { useEffect, useRef } from 'react'
import { fireGoogleAdsConversion, normalizeAdsSendTos } from '@/lib/seo/analytics'

type GoogleAdsPurchaseConversionProps = {
  orderId: string
  /** Total do pedido em reais (mesmo valor cobrado). */
  value: number
  /** Só dispara quando true (pagamento confirmado). */
  paid: boolean
  /** Uma ou mais ações send_to: AW-XXXX/label */
  sendTos: string[] | null | undefined
}

/**
 * Conversão Google Ads "Compra" — só com pedido pago,
 * com value e transaction_id reais (evita deturpação e duplicata).
 * Dispara todas as ações configuradas no admin (até 5).
 */
export function GoogleAdsPurchaseConversion({
  orderId,
  value,
  paid,
  sendTos,
}: GoogleAdsPurchaseConversionProps) {
  const startedRef = useRef(false)
  const normalized = normalizeAdsSendTos(sendTos ?? [])

  useEffect(() => {
    if (!paid || normalized.length === 0 || startedRef.current) return
    startedRef.current = true
    fireGoogleAdsConversion({
      sendTo: normalized,
      value,
      transactionId: orderId,
    })
  }, [paid, orderId, value, normalized.join('|')])

  return null
}
