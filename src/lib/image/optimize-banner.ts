import sharp from 'sharp'

const MAX_WIDTH = 1920
const MAX_HEIGHT = 720
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

export async function optimizeBannerImage(file: Buffer): Promise<OptimizedBannerImage> {
  if (file.byteLength > MAX_INPUT_BYTES) {
    throw new Error('Imagem muito grande. Máximo 8 MB antes da otimização.')
  }

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
