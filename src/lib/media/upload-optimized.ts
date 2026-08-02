import { createAdminClient } from '@/lib/supabase/admin'
import { toSiteMediaUrl } from '@/lib/media/public-url'
import {
  buildVariantStoragePath,
  isRasterImageMime,
  optimizeImageVariants,
} from '@/lib/image/optimize-variants'

type UploadVariantsResult = {
  storagePath: string
  publicUrl: string
  thumbUrl: string
  mediumUrl: string
  mimeType: string
  sizeBytes: number
  pathsToCleanup: string[]
}

/**
 * Faz upload de large (canônico) + thumb + medium em WebP no mesmo bucket.
 */
export async function uploadOptimizedMediaVariants(params: {
  bucket: string
  fileBuffer: Buffer
  baseId?: string
  folder?: string
}): Promise<UploadVariantsResult> {
  const admin = createAdminClient()
  const baseId = params.baseId ?? `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
  const folder = params.folder ? `${params.folder.replace(/\/+$/, '')}/` : ''

  const variants = await optimizeImageVariants(params.fileBuffer)
  const large = variants.find((v) => v.name === 'large')
  const thumb = variants.find((v) => v.name === 'thumb')
  const medium = variants.find((v) => v.name === 'medium')

  if (!large || !thumb || !medium) {
    throw new Error('Falha ao gerar variantes de imagem')
  }

  const pathsToCleanup: string[] = []
  const uploaded: { name: string; path: string; url: string; size: number }[] = []

  for (const variant of [large, medium, thumb]) {
    const storagePath = `${folder}${buildVariantStoragePath(baseId, variant.suffix)}`
    const { error } = await admin.storage.from(params.bucket).upload(storagePath, variant.buffer, {
      contentType: variant.mimeType,
      upsert: false,
    })
    if (error) {
      if (pathsToCleanup.length) {
        await admin.storage.from(params.bucket).remove(pathsToCleanup)
      }
      throw new Error(error.message)
    }
    pathsToCleanup.push(storagePath)
    const { data: urlData } = admin.storage.from(params.bucket).getPublicUrl(storagePath)
    const url = toSiteMediaUrl(urlData.publicUrl) ?? urlData.publicUrl
    uploaded.push({ name: variant.name, path: storagePath, url, size: variant.size })
  }

  const largeUp = uploaded.find((u) => u.name === 'large')!
  const mediumUp = uploaded.find((u) => u.name === 'medium')!
  const thumbUp = uploaded.find((u) => u.name === 'thumb')!

  return {
    storagePath: largeUp.path,
    publicUrl: largeUp.url,
    thumbUrl: thumbUp.url,
    mediumUrl: mediumUp.url,
    mimeType: 'image/webp',
    sizeBytes: largeUp.size,
    pathsToCleanup,
  }
}

export { isRasterImageMime }
