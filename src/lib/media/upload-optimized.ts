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
  let uploaded: { name: string; path: string; url: string; size: number }[]
  try {
    uploaded = await Promise.all(
      [large, medium, thumb].map(async (variant) => {
        const storagePath = `${folder}${buildVariantStoragePath(baseId, variant.suffix)}`
        const { error } = await admin.storage.from(params.bucket).upload(storagePath, variant.buffer, {
          contentType: variant.mimeType,
          upsert: false,
        })
        if (error) throw new Error(error.message)
        pathsToCleanup.push(storagePath)
        const { data: urlData } = admin.storage.from(params.bucket).getPublicUrl(storagePath)
        const url = toSiteMediaUrl(urlData.publicUrl) ?? urlData.publicUrl
        return { name: variant.name, path: storagePath, url, size: variant.size }
      })
    )
  } catch (error) {
    if (pathsToCleanup.length) {
      await admin.storage.from(params.bucket).remove(pathsToCleanup)
    }
    throw error
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

/** Envia o arquivo original quando a otimização em WebP falha. */
export async function uploadOriginalMedia(params: {
  bucket: string
  fileBuffer: Buffer
  contentType: string
  extension: string
}): Promise<UploadVariantsResult> {
  const admin = createAdminClient()
  const storagePath = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${params.extension}`
  const { error } = await admin.storage.from(params.bucket).upload(storagePath, params.fileBuffer, {
    contentType: params.contentType,
    upsert: false,
  })
  if (error) throw new Error(error.message)

  const { data: urlData } = admin.storage.from(params.bucket).getPublicUrl(storagePath)
  const url = toSiteMediaUrl(urlData.publicUrl) ?? urlData.publicUrl

  return {
    storagePath,
    publicUrl: url,
    thumbUrl: url,
    mediumUrl: url,
    mimeType: params.contentType,
    sizeBytes: params.fileBuffer.byteLength,
    pathsToCleanup: [storagePath],
  }
}

export { isRasterImageMime }
