import QRCode from 'qrcode'

/**
 * A AllowPay não devolve validade da cobrança.
 * Mantemos 24h como referência de exibição no checkout (mesmo prazo usado antes).
 */
const PIX_DISPLAY_EXPIRATION_HOURS = 24

export async function buildPixQrImage(copyPaste: string): Promise<string> {
  return QRCode.toDataURL(copyPaste, {
    margin: 1,
    width: 256,
    errorCorrectionLevel: 'M',
  })
}

export function buildPixDisplayExpiration(from: Date = new Date()): string {
  return new Date(from.getTime() + PIX_DISPLAY_EXPIRATION_HOURS * 60 * 60 * 1000).toISOString()
}
