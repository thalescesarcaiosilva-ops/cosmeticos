import QRCode from 'qrcode'

export async function buildPixQrImage(copyPaste: string): Promise<string> {
  return QRCode.toDataURL(copyPaste, {
    margin: 1,
    width: 256,
    errorCorrectionLevel: 'M',
  })
}

/** Usa expires_at da Veno quando existir; senão 24h de referência visual. */
export function resolvePixExpiration(expiresAt: string | null | undefined): string {
  if (expiresAt) {
    const t = Date.parse(expiresAt)
    if (!Number.isNaN(t)) return new Date(t).toISOString()
  }
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
}
