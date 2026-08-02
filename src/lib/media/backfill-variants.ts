import { createAdminClient } from '@/lib/supabase/admin'
import { toSiteMediaUrl } from '@/lib/media/public-url'
import {
  isRasterImageMime,
  optimizeImageVariants,
  siblingVariantPaths,
} from '@/lib/image/optimize-variants'

export type MediaBackfillRow = {
  id: string
  storage_path: string
  bucket: string
  public_url: string
  mime_type: string | null
  thumb_url: string | null
  medium_url: string | null
}

export type BackfillItemResult = {
  id: string
  status: 'updated' | 'skipped' | 'error'
  message?: string
}

export type BackfillBatchResult = {
  processed: number
  updated: number
  skipped: number
  failed: number
  remaining: number
  items: BackfillItemResult[]
}

const DEFAULT_BATCH = 8
const MAX_BATCH = 20

/**
 * Gera thumb/medium para mídias antigas SEM alterar public_url (Merchant/JSON-LD).
 */
export async function backfillMediaVariantsBatch(
  limit = DEFAULT_BATCH
): Promise<BackfillBatchResult> {
  const admin = createAdminClient()
  const batchSize = Math.min(MAX_BATCH, Math.max(1, limit))

  const { data: rows, error } = await admin
    .from('media_assets')
    .select('id, storage_path, bucket, public_url, mime_type, thumb_url, medium_url')
    .or('thumb_url.is.null,medium_url.is.null')
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (error) {
    throw new Error(
      error.message.includes('thumb_url')
        ? 'Aplique a migration 202607300002_media_variants.sql no Supabase.'
        : error.message
    )
  }

  const assets = (rows ?? []) as MediaBackfillRow[]
  const items: BackfillItemResult[] = []
  let updated = 0
  let skipped = 0
  let failed = 0

  for (const asset of assets) {
    try {
      const result = await backfillOneAsset(admin, asset)
      items.push(result)
      if (result.status === 'updated') updated += 1
      else if (result.status === 'skipped') skipped += 1
      else failed += 1
    } catch (err) {
      failed += 1
      items.push({
        id: asset.id,
        status: 'error',
        message: err instanceof Error ? err.message : 'Falha desconhecida',
      })
    }
  }

  const { count: remaining } = await admin
    .from('media_assets')
    .select('id', { count: 'exact', head: true })
    .or('thumb_url.is.null,medium_url.is.null')

  return {
    processed: assets.length,
    updated,
    skipped,
    failed,
    remaining: remaining ?? 0,
    items,
  }
}

export async function countMediaMissingVariants(): Promise<number> {
  const admin = createAdminClient()
  const { count, error } = await admin
    .from('media_assets')
    .select('id', { count: 'exact', head: true })
    .or('thumb_url.is.null,medium_url.is.null')

  if (error) {
    if (error.message.includes('thumb_url')) return 0
    throw new Error(error.message)
  }
  return count ?? 0
}

async function backfillOneAsset(
  admin: ReturnType<typeof createAdminClient>,
  asset: MediaBackfillRow
): Promise<BackfillItemResult> {
  if (asset.thumb_url && asset.medium_url) {
    return { id: asset.id, status: 'skipped', message: 'Já possui variantes' }
  }

  const mime = asset.mime_type ?? ''
  if (mime === 'image/svg+xml' || (mime && !isRasterImageMime(mime))) {
    return { id: asset.id, status: 'skipped', message: 'Formato sem variantes (SVG/etc.)' }
  }

  const { data: fileData, error: downloadError } = await admin.storage
    .from(asset.bucket)
    .download(asset.storage_path)

  if (downloadError || !fileData) {
    throw new Error(downloadError?.message ?? 'Não foi possível baixar a imagem canônica')
  }

  const buffer = Buffer.from(await fileData.arrayBuffer())
  const variants = await optimizeImageVariants(buffer, { only: ['thumb', 'medium'] })
  const thumb = variants.find((v) => v.name === 'thumb')
  const medium = variants.find((v) => v.name === 'medium')
  if (!thumb || !medium) throw new Error('Falha ao gerar thumb/medium')

  const paths = siblingVariantPaths(asset.storage_path)
  const uploadedPaths: string[] = []

  const toUpload = [
    { variant: thumb, path: paths.thumb },
    { variant: medium, path: paths.medium },
  ] as const

  for (const item of toUpload) {
    const { error: uploadError } = await admin.storage
      .from(asset.bucket)
      .upload(item.path, item.variant.buffer, {
        contentType: item.variant.mimeType,
        upsert: true,
      })
    if (uploadError) {
      if (uploadedPaths.length) {
        await admin.storage.from(asset.bucket).remove(uploadedPaths)
      }
      throw new Error(uploadError.message)
    }
    uploadedPaths.push(item.path)
  }

  const thumbPublic = admin.storage.from(asset.bucket).getPublicUrl(paths.thumb).data.publicUrl
  const mediumPublic = admin.storage.from(asset.bucket).getPublicUrl(paths.medium).data.publicUrl

  const thumbUrl = toSiteMediaUrl(thumbPublic) ?? thumbPublic
  const mediumUrl = toSiteMediaUrl(mediumPublic) ?? mediumPublic

  // NÃO altera public_url — Merchant / JSON-LD permanecem estáveis
  const { error: updateError } = await admin
    .from('media_assets')
    .update({
      thumb_url: thumbUrl,
      medium_url: mediumUrl,
    })
    .eq('id', asset.id)

  if (updateError) {
    await admin.storage.from(asset.bucket).remove(uploadedPaths)
    throw new Error(updateError.message)
  }

  return { id: asset.id, status: 'updated' }
}
