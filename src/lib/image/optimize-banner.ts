type SharpFactory = Awaited<typeof import('sharp')>['default']

let sharpModule: SharpFactory | null = null

async function getSharp(): Promise<SharpFactory> {
  if (!sharpModule) {
    const mod = await import('sharp')
    sharpModule = mod.default ?? (mod as unknown as SharpFactory)
  }
  return sharpModule
}

/** Limites generosos: preservam a proporção enviada (desktop landscape ou mobile portrait). */
const MAX_WIDTH = 1920
const MAX_HEIGHT = 2400
const WEBP_QUALITY = 82
const ALLOWED_INPUT = ['image/jpeg', 'image/png', 'image/webp'] as const
const MAX_INPUT_BYTES = 8 * 1024 * 1024

export type OptimizedBannerImage = {
  buffer: Buffer
  width: number
  height: number
  size: number
  mimeType: 'image/webp'
  extension: 'webp'
}

export function isAllowedBannerMime(type: string): boolean {
  return (ALLOWED_INPUT as readonly string[]).includes(type)
}

/** Lê width/height de PNG/JPEG/WebP sem sharp (fallback quando o binário nativo falha). */
export function probeImageDimensions(file: Buffer): { width: number; height: number } | null {
  if (file.length < 24) return null

  // PNG
  if (file[0] === 0x89 && file[1] === 0x50 && file[2] === 0x4e && file[3] === 0x47) {
    return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) }
  }

  // JPEG
  if (file[0] === 0xff && file[1] === 0xd8) {
    let i = 2
    while (i < file.length - 8) {
      if (file[i] !== 0xff) {
        i += 1
        continue
      }
      const marker = file[i + 1]
      if (marker === 0xd8 || marker === 0xd9) {
        i += 2
        continue
      }
      const size = file.readUInt16BE(i + 2)
      // SOF0 / SOF2
      if (marker === 0xc0 || marker === 0xc2) {
        return { height: file.readUInt16BE(i + 5), width: file.readUInt16BE(i + 7) }
      }
      i += 2 + size
    }
  }

  // WebP (RIFF....WEBP)
  if (
    file.toString('ascii', 0, 4) === 'RIFF' &&
    file.toString('ascii', 8, 12) === 'WEBP'
  ) {
    const chunk = file.toString('ascii', 12, 16)
    if (chunk === 'VP8 ' && file.length >= 30) {
      return {
        width: file.readUInt16LE(26) & 0x3fff,
        height: file.readUInt16LE(28) & 0x3fff,
      }
    }
    if (chunk === 'VP8L' && file.length >= 25) {
      const bits = file.readUInt32LE(21)
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      }
    }
    if (chunk === 'VP8X' && file.length >= 30) {
      return {
        width: 1 + file[24] + (file[25] << 8) + (file[26] << 16),
        height: 1 + file[27] + (file[28] << 8) + (file[29] << 16),
      }
    }
  }

  return null
}

export async function optimizeBannerImage(file: Buffer): Promise<OptimizedBannerImage> {
  if (file.byteLength > MAX_INPUT_BYTES) {
    throw new Error('Imagem muito grande. Máximo 8 MB antes da otimização.')
  }

  const sharp = await getSharp()
  const image = sharp(file, { failOn: 'none' })
  const metadata = await image.metadata()

  if (!metadata.width || !metadata.height) {
    throw new Error('Não foi possível ler a imagem.')
  }

  const buffer = await image
    .rotate()
    .resize({
      width: MAX_WIDTH,
      height: MAX_HEIGHT,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY, effort: 4 })
    .toBuffer()

  const optimized = sharp(buffer)
  const info = await optimized.metadata()

  return {
    buffer,
    width: info.width ?? metadata.width,
    height: info.height ?? metadata.height,
    size: buffer.byteLength,
    mimeType: 'image/webp',
    extension: 'webp',
  }
}
