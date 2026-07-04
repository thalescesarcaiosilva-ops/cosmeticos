import QRCode from 'qrcode'

type PixPayload = Record<string, unknown>

const COPY_PASTE_KEYS = [
  'qrcodeText',
  'qrcode',
  'copyPaste',
  'emv',
  'qrCode',
  'qrCodeText',
  'copy_paste',
  'pixCopyPaste',
] as const

function readNested(obj: unknown, ...keys: string[]): string | null {
  if (!obj || typeof obj !== 'object') return null
  const record = obj as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return null
}

export function extractPixCopyPaste(payload: PixPayload): string | null {
  for (const key of COPY_PASTE_KEYS) {
    const direct = readNested(payload, key)
    if (direct) return direct
  }

  const pix = payload.pix
  if (pix && typeof pix === 'object') {
    for (const key of COPY_PASTE_KEYS) {
      const nested = readNested(pix, key)
      if (nested) return nested
    }
  }

  const payment = payload.payment
  if (payment && typeof payment === 'object') {
    for (const key of COPY_PASTE_KEYS) {
      const nested = readNested(payment, key)
      if (nested) return nested
    }
  }

  return null
}

export function extractPixExpiration(payload: PixPayload): string | null {
  const pix = payload.pix
  const candidates = [
    readNested(payload, 'expiresAt', 'expirationDate'),
    pix && typeof pix === 'object'
      ? readNested(pix, 'expiresAt', 'expirationDate')
      : null,
  ]
  return candidates.find(Boolean) ?? null
}

export function extractPixImageUrl(payload: PixPayload): string | null {
  const candidates = [
    readNested(payload, 'qrcodeImage', 'qrCodeImage', 'qrCodeUrl'),
    payload.pix && typeof payload.pix === 'object'
      ? readNested(payload.pix as Record<string, unknown>, 'qrcodeImage', 'qrCodeImage', 'qrCodeUrl')
      : null,
  ]
  return candidates.find(Boolean) ?? null
}

export async function buildPixQrImage(copyPaste: string): Promise<string> {
  return QRCode.toDataURL(copyPaste, {
    margin: 1,
    width: 256,
    errorCorrectionLevel: 'M',
  })
}

export async function resolvePixDisplay(payload: PixPayload): Promise<{
  copyPaste: string | null
  qrImage: string | null
  expiresAt: string | null
}> {
  const copyPaste = extractPixCopyPaste(payload)
  const imageUrl = extractPixImageUrl(payload)
  const expiresAt = extractPixExpiration(payload)

  let qrImage: string | null = imageUrl
  if (!qrImage && copyPaste) {
    qrImage = await buildPixQrImage(copyPaste)
  }

  return { copyPaste, qrImage, expiresAt }
}

export function isPaidStatus(status: string | null | undefined): boolean {
  if (!status) return false
  const normalized = status.toLowerCase()
  return normalized === 'paid' || normalized === 'approved' || normalized === 'authorized'
}

export function isFailedStatus(status: string | null | undefined): boolean {
  if (!status) return false
  const normalized = status.toLowerCase()
  return ['refused', 'chargedback', 'cancelled', 'canceled', 'expired', 'failed'].includes(
    normalized
  )
}
