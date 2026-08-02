type SharpFactory = Awaited<typeof import('sharp')>['default']

let sharpModule: SharpFactory | null = null

async function getSharp(): Promise<SharpFactory> {
  if (!sharpModule) {
    const mod = await import('sharp')
    sharpModule = mod.default ?? (mod as unknown as SharpFactory)
  }
  return sharpModule
}

const MAX_INPUT_BYTES = 10 * 1024 * 1024
const WEBP_QUALITY = 82

export type ImageVariantName = 'thumb' | 'medium' | 'large'

export type OptimizedVariant = {
  name: ImageVariantName
  buffer: Buffer
  width: number
  height: number
  size: number
  mimeType: 'image/webp'
  extension: 'webp'
  /** Sufixo no storage path: file.thumb.webp */
  suffix: string
}

const VARIANT_SPECS: {
  name: ImageVariantName
  maxEdge: number
  suffix: string
}[] = [
  { name: 'thumb', maxEdge: 400, suffix: 'thumb' },
  { name: 'medium', maxEdge: 800, suffix: 'medium' },
  { name: 'large', maxEdge: 1600, suffix: 'large' },
]

/**
 * Gera thumb/medium/large em WebP no upload — o site serve esses arquivos
 * direto (unoptimized), sem transforms da Vercel, mantendo velocidade.
 */
export async function optimizeImageVariants(
  file: Buffer,
  options?: { only?: ImageVariantName[] }
): Promise<OptimizedVariant[]> {
  if (file.byteLength > MAX_INPUT_BYTES) {
    throw new Error('Imagem muito grande')
  }

  const sharp = await getSharp()
  const base = sharp(file, { failOn: 'none' }).rotate()
  const metadata = await base.metadata()

  if (!metadata.width || !metadata.height) {
    throw new Error('Imagem inválida')
  }

  const specs = options?.only?.length
    ? VARIANT_SPECS.filter((spec) => options.only!.includes(spec.name))
    : VARIANT_SPECS

  const variants: OptimizedVariant[] = []

  for (const spec of specs) {
    const buffer = await sharp(file, { failOn: 'none' })
      .rotate()
      .resize({
        width: spec.maxEdge,
        height: spec.maxEdge,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer()

    const info = await sharp(buffer).metadata()
    variants.push({
      name: spec.name,
      buffer,
      width: info.width ?? metadata.width,
      height: info.height ?? metadata.height,
      size: buffer.byteLength,
      mimeType: 'image/webp',
      extension: 'webp',
      suffix: spec.suffix,
    })
  }

  return variants
}

/** Base do path sem extensão (para `.thumb.webp` / `.medium.webp` ao lado do canônico). */
export function storagePathBase(storagePath: string): string {
  return storagePath.replace(/\.(webp|jpe?g|png|gif|avif)$/i, '')
}

export function siblingVariantPaths(storagePath: string): {
  thumb: string
  medium: string
} {
  const base = storagePathBase(storagePath)
  return {
    thumb: buildVariantStoragePath(base, 'thumb'),
    medium: buildVariantStoragePath(base, 'medium'),
  }
}

export function buildVariantStoragePath(baseId: string, suffix: string): string {
  return `${baseId}.${suffix}.webp`
}

export function isRasterImageMime(type: string): boolean {
  return ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type)
}

