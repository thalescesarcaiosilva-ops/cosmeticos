import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { toSiteMediaUrl } from '@/lib/media/public-url'
import {
  DEFAULT_PRODUCT_MEDIA_BUCKET,
  isMediaBucket,
  MEDIA_PAGE_SIZE,
  type MediaBucket,
} from '@/lib/media/buckets'
import { isRasterImageMime, uploadOptimizedMediaVariants } from '@/lib/media/upload-optimized'

const MEDIA_COLUMNS =
  'id, filename, storage_path, bucket, public_url, thumb_url, medium_url, mime_type, size_bytes, alt_text, created_at'

const MEDIA_COLUMNS_LEGACY =
  'id, filename, storage_path, bucket, public_url, mime_type, size_bytes, alt_text, created_at'

async function requireAdmin() {
  try {
    return await requireAdminUser()
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return jsonError('Não autorizado', 401, 'UNAUTHORIZED')
    }
    if (e instanceof Error && e.message === 'FORBIDDEN') {
      return jsonError('Acesso negado', 403, 'FORBIDDEN')
    }
    return jsonError('Erro interno', 500)
  }
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
const MAX_SIZE = 5 * 1024 * 1024

function normalizeMediaAssetUrls<
  T extends { public_url: string | null; thumb_url?: string | null; medium_url?: string | null },
>(items: T[]): T[] {
  return items.map((item) => ({
    ...item,
    public_url: toSiteMediaUrl(item.public_url) ?? item.public_url,
    thumb_url: item.thumb_url ? toSiteMediaUrl(item.thumb_url) ?? item.thumb_url : item.thumb_url,
    medium_url: item.medium_url
      ? toSiteMediaUrl(item.medium_url) ?? item.medium_url
      : item.medium_url,
  }))
}

function resolveBucket(raw: FormDataEntryValue | null): MediaBucket {
  if (typeof raw === 'string' && isMediaBucket(raw)) return raw
  return DEFAULT_PRODUCT_MEDIA_BUCKET
}

export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(request.url)
  const bucketParam = searchParams.get('bucket')
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const limit = Math.min(
    48,
    Math.max(1, Number.parseInt(searchParams.get('limit') ?? String(MEDIA_PAGE_SIZE), 10) || MEDIA_PAGE_SIZE)
  )
  const from = (page - 1) * limit
  const to = from + limit - 1

  const supabase = await createClient()
  let query = supabase
    .from('media_assets')
    .select(MEDIA_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })

  if (bucketParam && bucketParam !== 'all' && isMediaBucket(bucketParam)) {
    query = query.eq('bucket', bucketParam)
  }

  let { data, error, count } = await query.range(from, to)

  if (error) {
    let legacyQuery = supabase
      .from('media_assets')
      .select(MEDIA_COLUMNS_LEGACY, { count: 'exact' })
      .order('created_at', { ascending: false })
    if (bucketParam && bucketParam !== 'all' && isMediaBucket(bucketParam)) {
      legacyQuery = legacyQuery.eq('bucket', bucketParam)
    }
    const legacy = await legacyQuery.range(from, to)
    if (legacy.error) {
      return jsonError('Não foi possível carregar a biblioteca de mídia', 500)
    }
    data = legacy.data as typeof data
    count = legacy.count
    error = null
  }

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / limit))

  return NextResponse.json({
    error: false,
    data: normalizeMediaAssetUrls(data ?? []),
    meta: { page, limit, total, totalPages },
  })
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return jsonError('Arquivo inválido', 400)
  }

  const file = formData.get('file')
  const altText = formData.get('alt_text')
  const bucket = resolveBucket(formData.get('bucket'))

  if (!(file instanceof File)) {
    return jsonError('Envie um arquivo de imagem', 400)
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return jsonError('Formato não permitido. Use JPEG, PNG, WebP, GIF ou SVG.', 400)
  }

  if (file.size > MAX_SIZE) {
    return jsonError('Arquivo muito grande. Máximo 5 MB.', 400)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const admin = createAdminClient()
  const alt =
    typeof altText === 'string' && altText.trim() ? altText.trim() : null

  // SVG: sem sharp — upload direto
  if (file.type === 'image/svg+xml' || !isRasterImageMime(file.type)) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'svg'
    const storagePath = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`
    const { error: uploadError } = await admin.storage
      .from(bucket)
      .upload(storagePath, buffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      return jsonError(
        'Falha no upload. Verifique se PARTE_4_storage.sql foi executado no Supabase.',
        400
      )
    }

    const { data: urlData } = admin.storage.from(bucket).getPublicUrl(storagePath)
    const normalizedPublicUrl = toSiteMediaUrl(urlData.publicUrl) ?? urlData.publicUrl

    const { data, error } = await admin
      .from('media_assets')
      .insert({
        filename: file.name,
        storage_path: storagePath,
        bucket,
        public_url: normalizedPublicUrl,
        mime_type: file.type,
        size_bytes: file.size,
        alt_text: alt,
        uploaded_by: auth.id,
      })
      .select(MEDIA_COLUMNS_LEGACY)
      .single()

    if (error || !data) {
      await admin.storage.from(bucket).remove([storagePath])
      return jsonError('Não foi possível registrar a mídia', 400)
    }

    return jsonSuccess(
      {
        ...data,
        public_url: toSiteMediaUrl(data.public_url) ?? data.public_url,
        thumb_url: null,
        medium_url: null,
      },
      'Imagem enviada',
      201
    )
  }

  let uploaded
  try {
    uploaded = await uploadOptimizedMediaVariants({
      bucket,
      fileBuffer: buffer,
    })
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[media/upload]', err)
    }
    return jsonError('Falha ao otimizar/enviar a imagem', 400)
  }

  const insertPayload = {
    filename: file.name,
    storage_path: uploaded.storagePath,
    bucket,
    public_url: uploaded.publicUrl,
    thumb_url: uploaded.thumbUrl,
    medium_url: uploaded.mediumUrl,
    mime_type: uploaded.mimeType,
    size_bytes: uploaded.sizeBytes,
    alt_text: alt,
    uploaded_by: auth.id,
  }

  let { data, error } = await admin
    .from('media_assets')
    .insert(insertPayload)
    .select(MEDIA_COLUMNS)
    .single()

  if (error) {
    const legacyInsert = await admin
      .from('media_assets')
      .insert({
        filename: file.name,
        storage_path: uploaded.storagePath,
        bucket,
        public_url: uploaded.publicUrl,
        mime_type: uploaded.mimeType,
        size_bytes: uploaded.sizeBytes,
        alt_text: alt,
        uploaded_by: auth.id,
      })
      .select(MEDIA_COLUMNS_LEGACY)
      .single()

    if (legacyInsert.error || !legacyInsert.data) {
      await admin.storage.from(bucket).remove(uploaded.pathsToCleanup)
      return jsonError(
        'Não foi possível registrar a mídia. Aplique a migration 202607300002_media_variants.sql.',
        400
      )
    }
    data = {
      ...legacyInsert.data,
      thumb_url: uploaded.thumbUrl,
      medium_url: uploaded.mediumUrl,
    } as typeof data
    error = null
  }

  if (!data) {
    await admin.storage.from(bucket).remove(uploaded.pathsToCleanup)
    return jsonError('Não foi possível registrar a mídia', 400)
  }

  return jsonSuccess(
    {
      ...data,
      public_url: toSiteMediaUrl(data.public_url) ?? data.public_url,
      thumb_url: toSiteMediaUrl(
        (data as { thumb_url?: string | null }).thumb_url ?? uploaded.thumbUrl
      ),
      medium_url: toSiteMediaUrl(
        (data as { medium_url?: string | null }).medium_url ?? uploaded.mediumUrl
      ),
    },
    'Imagem enviada',
    201
  )
}
