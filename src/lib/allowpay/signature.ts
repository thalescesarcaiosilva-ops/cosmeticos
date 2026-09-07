import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Valida o header `X-AllowPay-Signature` (HMAC-SHA256 do corpo BRUTO).
 * Formato esperado: `sha256=<hmac-hex>`.
 */
export function verifyAllowPaySignature(params: {
  rawBody: string
  signature: string | null
  secret: string
}): boolean {
  if (!params.signature) return false

  const expected = `sha256=${createHmac('sha256', params.secret)
    .update(params.rawBody, 'utf8')
    .digest('hex')}`

  const received = Buffer.from(params.signature)
  const expectedBuffer = Buffer.from(expected)

  if (received.length !== expectedBuffer.length) return false
  return timingSafeEqual(received, expectedBuffer)
}
