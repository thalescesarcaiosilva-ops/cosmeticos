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

const MEDIA_COLUMNS =
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

function normalizeMediaAssetUrls<T extends { public_url: string | null }>(items: T[]): T[] {
  return items.map((item) => ({
    ...item,
    public_url: toSiteMediaUrl(item.public_url) ?? item.public_url,
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

  const { data, error, count } = await query.range(from, to)

  if (error) {
    return jsonError('Não foi possível carregar a biblioteca de mídia', 500)
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

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const storagePath = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from(bucket)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[media/upload]', uploadError.message)
    }
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
      alt_text: typeof altText === 'string' && altText.trim() ? altText.trim() : null,
      uploaded_by: auth.id,
    })
    .select(MEDIA_COLUMNS)
    .single()

  if (error || !data) {
    await admin.storage.from(bucket).remove([storagePath])
    return jsonError('Não foi possível registrar a mídia', 400)
  }

  return jsonSuccess(
    {
      ...data,
      public_url: toSiteMediaUrl(data.public_url) ?? data.public_url,
    },
    'Imagem enviada',
    201
  )
}
