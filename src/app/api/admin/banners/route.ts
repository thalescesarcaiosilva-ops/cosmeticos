import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { toSiteMediaUrl } from '@/lib/media/public-url'
import { BANNER_COLUMNS, getAdminHomeBanners } from '@/lib/banners/queries'
import {
  isAllowedBannerMime,
  optimizeBannerImage,
  probeImageDimensions,
} from '@/lib/image/optimize-banner'
import { createBannerSchema } from '@/schemas/banner-schema'

const BANNER_COLUMNS_INSERT_LEGACY =
  'id, title, alt_text, link_href, image_url, storage_path, width, height, file_size, sort_order, active, created_at'

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

export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  let client
  try {
    client = createAdminClient()
  } catch {
    client = await createClient()
  }

  try {
    const data = await getAdminHomeBanners(client)
    return jsonSuccess(data)
  } catch (e) {
    console.error('[banners/list]', e instanceof Error ? e.message : e)
    return jsonError('Não foi possível carregar os banners', 500)
  }
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
  if (!(file instanceof File)) {
    return jsonError('Envie uma imagem para o banner', 400)
  }

  if (!isAllowedBannerMime(file.type)) {
    return jsonError('Formato não permitido. Use JPEG, PNG ou WebP.', 400)
  }

  const meta = createBannerSchema.safeParse({
    title: formData.get('title') ?? '',
    alt_text: formData.get('alt_text') || null,
    link_href: formData.get('link_href') || null,
    active: formData.get('active') !== 'false',
    device_target: formData.get('device_target') ?? 'both',
  })

  if (!meta.success) {
    return jsonError(meta.error.issues[0]?.message ?? 'Dados inválidos', 400)
  }

  const raw = Buffer.from(await file.arrayBuffer())

  type BannerUpload = {
    buffer: Buffer
    width: number | null
    height: number | null
    size: number
    mimeType: string
    extension: string
  }

  let optimized: BannerUpload
  try {
    optimized = await optimizeBannerImage(raw)
  } catch (e) {
    // Se o sharp falhar no runtime (ex.: binário nativo indisponível no deploy),
    // faz upload da imagem original para não bloquear o cadastro do banner.
    console.error('[banners/optimize]', e instanceof Error ? e.message : e)
    const fallbackExt =
      file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const probed = probeImageDimensions(raw)
    optimized = {
      buffer: raw,
      width: probed?.width ?? null,
      height: probed?.height ?? null,
      size: raw.byteLength,
      mimeType: file.type,
      extension: fallbackExt,
    }
  }

  const storagePath = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${optimized.extension}`
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return jsonError(
      'Configuração ausente no deploy: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.',
      503
    )
  }

  const { error: uploadError } = await admin.storage
    .from('banners')
    .upload(storagePath, optimized.buffer, {
      contentType: optimized.mimeType,
      upsert: false,
    })

  if (uploadError) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[banners/upload]', uploadError.message)
    }
    return jsonError(
      'Falha no upload. Verifique se PARTE_4_storage.sql foi executado no Supabase.',
      400
    )
  }

  const { data: urlData } = admin.storage.from('banners').getPublicUrl(storagePath)
  const normalizedPublicUrl = toSiteMediaUrl(urlData.publicUrl) ?? urlData.publicUrl

  const { count } = await admin
    .from('home_banners')
    .select('id', { count: 'exact', head: true })

  const insertPayload = {
    title: meta.data.title?.trim() || 'Banner',
    alt_text: meta.data.alt_text?.trim() || null,
    link_href: meta.data.link_href?.trim() || null,
    image_url: normalizedPublicUrl,
    storage_path: storagePath,
    width: optimized.width,
    height: optimized.height,
    file_size: optimized.size,
    sort_order: count ?? 0,
    active: meta.data.active ?? true,
    device_target: meta.data.device_target ?? 'both',
  }

  let inserted = await admin
    .from('home_banners')
    .insert(insertPayload)
    .select(BANNER_COLUMNS)
    .single()

  if (inserted.error) {
    console.error('[banners/insert]', inserted.error.message)
    const missingDeviceTarget = /device_target/i.test(inserted.error.message)
    if (missingDeviceTarget) {
      const legacyPayload = { ...insertPayload }
      delete (legacyPayload as { device_target?: string }).device_target
      inserted = await admin
        .from('home_banners')
        .insert(legacyPayload)
        .select(BANNER_COLUMNS_INSERT_LEGACY)
        .single()
    }
  }

  if (inserted.error || !inserted.data) {
    await admin.storage.from('banners').remove([storagePath])
    return jsonError(
      inserted.error?.message
        ? `Não foi possível registrar o banner: ${inserted.error.message}`
        : 'Não foi possível registrar o banner',
      400
    )
  }

  revalidatePath('/')
  return jsonSuccess(inserted.data, 'Banner adicionado', 201)
}
