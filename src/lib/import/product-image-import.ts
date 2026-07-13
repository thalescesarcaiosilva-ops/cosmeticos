import sharp from 'sharp'
import { isBlockedImageUrl } from '@/lib/import/image-source-policy'

const MAX_WIDTH = 1200
const MAX_HEIGHT = 1200
const WEBP_QUALITY = 85
const MAX_INPUT_BYTES = 10 * 1024 * 1024

export type OptimizedProductImage = {
  buffer: Buffer
  width: number
  height: number
  size: number
  mimeType: 'image/webp'
  extension: 'webp'
}

export async function optimizeProductImage(file: Buffer): Promise<OptimizedProductImage> {
  if (file.byteLength > MAX_INPUT_BYTES) {
    throw new Error('Imagem muito grande')
  }

  const image = sharp(file, { failOn: 'none' })
  const metadata = await image.metadata()

  if (!metadata.width || !metadata.height) {
    throw new Error('Imagem inválida')
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

  const info = await sharp(buffer).metadata()

  return {
    buffer,
    width: info.width ?? metadata.width,
    height: info.height ?? metadata.height,
    size: buffer.byteLength,
    mimeType: 'image/webp',
    extension: 'webp',
  }
}

export async function downloadRemoteImage(url: string): Promise<Buffer> {
  if (isBlockedImageUrl(url)) {
    throw new Error('URL de imagem bloqueada')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'LojaCosmeticos-ProductImport/1.0',
        Accept: 'image/*',
      },
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) {
      throw new Error('Resposta não é imagem')
    }

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.byteLength > MAX_INPUT_BYTES) {
      throw new Error('Imagem excede tamanho máximo')
    }

    return buffer
  } finally {
    clearTimeout(timeout)
  }
}
