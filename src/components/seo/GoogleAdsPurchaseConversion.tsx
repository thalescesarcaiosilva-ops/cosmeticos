'use client'

import { useEffect, useRef } from 'react'
import { fireGoogleAdsConversion, normalizeAdsSendTos } from '@/lib/seo/analytics'

type GoogleAdsPurchaseConversionProps = {
  orderId: string
  /** Total do pedido em reais (mesmo valor cobrado). */
  value: number
  /** Uma ou mais ações send_to: AW-XXXX/label */
  sendTos: string[] | null | undefined
}

/**
 * Conversão Google Ads "Compra" — dispara para todo pedido gerado
 * (assim que a página de obrigado carrega), com value e transaction_id
 * reais. Deduplicado por pedido (1x por transaction_id).
 * Dispara todas as ações configuradas no admin (até 5).
 */
export function GoogleAdsPurchaseConversion({
  orderId,
  value,
  sendTos,
}: GoogleAdsPurchaseConversionProps) {
  const startedRef = useRef(false)
  const normalized = normalizeAdsSendTos(sendTos ?? [])

  useEffect(() => {
    if (normalized.length === 0 || startedRef.current) return
    startedRef.current = true
    fireGoogleAdsConversion({
      sendTo: normalized,
      value,
      transactionId: orderId,
    })
  }, [orderId, value, normalized.join('|')])

  return null
}
