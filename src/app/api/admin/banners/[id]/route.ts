import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { toSiteMediaUrl } from '@/lib/media/public-url'
import { BANNER_COLUMNS } from '@/lib/banners/queries'
import { isAllowedBannerMime, optimizeBannerImage } from '@/lib/image/optimize-banner'
import { updateBannerSchema } from '@/schemas/banner-schema'

const paramsSchema = z.object({ id: z.string().uuid() })

async function getWriteClient() {
  try {
    return createAdminClient()
  } catch {
    return await createClient()
  }
}

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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const { id } = paramsSchema.parse(await context.params)

  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return jsonError('Arquivo inválido', 400)
    }

    const file = formData.get('file')
    if (file instanceof File) {
      return patchWithImage(id, formData)
    }

    const parsed = updateBannerSchema.safeParse({
      title: formData.get('title') ?? undefined,
      alt_text: formData.get('alt_text') || null,
      link_href: formData.get('link_href') || null,
      active: formData.get('active') !== 'false',
      device_target: formData.get('device_target') ?? undefined,
    })

    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? 'Dados inválidos', 400)
    }

    const supabase = await getWriteClient()
    const { data, error } = await supabase
      .from('home_banners')
      .update(parsed.data)
      .eq('id', id)
      .select(BANNER_COLUMNS)
      .single()

    if (error || !data) {
      console.error('[banners/patch]', error?.message)
      return jsonError(
        error?.message
          ? `Não foi possível atualizar o banner: ${error.message}`
          : 'Não foi possível atualizar o banner',
        400
      )
    }

    revalidatePath('/')
    return jsonSuccess(data, 'Banner atualizado')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = updateBannerSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Dados inválidos', 400)
  }

  const supabase = await getWriteClient()
  const { data, error } = await supabase
    .from('home_banners')
    .update(parsed.data)
    .eq('id', id)
    .select(BANNER_COLUMNS)
    .single()

  if (error || !data) {
    console.error('[banners/patch]', error?.message)
    return jsonError(
      error?.message
        ? `Não foi possível atualizar o banner: ${error.message}`
        : 'Não foi possível atualizar o banner',
      400
    )
  }

  revalidatePath('/')
  return jsonSuccess(data, 'Banner atualizado')
}

async function patchWithImage(id: string, formData: FormData) {
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return jsonError('Envie uma imagem', 400)
  }

  if (!isAllowedBannerMime(file.type)) {
    return jsonError('Formato não permitido. Use JPEG, PNG ou WebP.', 400)
  }

  const meta = updateBannerSchema.safeParse({
    title: formData.get('title') ?? undefined,
    alt_text: formData.get('alt_text') || null,
    link_href: formData.get('link_href') || null,
    active: formData.get('active') !== 'false',
    device_target: formData.get('device_target') ?? undefined,
  })

  if (!meta.success) {
    return jsonError(meta.error.issues[0]?.message ?? 'Dados inválidos', 400)
  }

  const supabase = await getWriteClient()
  const { data: existing, error: fetchError } = await supabase
    .from('home_banners')
    .select('storage_path')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return jsonError('Banner não encontrado', 404)
  }

  let optimized
  try {
    const raw = Buffer.from(await file.arrayBuffer())
    optimized = await optimizeBannerImage(raw)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Falha ao otimizar a imagem'
    return jsonError(message, 400)
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
    return jsonError('Falha no upload da nova imagem', 400)
  }

  const { data: urlData } = admin.storage.from('banners').getPublicUrl(storagePath)
  const normalizedPublicUrl = toSiteMediaUrl(urlData.publicUrl) ?? urlData.publicUrl

  const updatePayload = {
    ...meta.data,
    image_url: normalizedPublicUrl,
    storage_path: storagePath,
    width: optimized.width,
    height: optimized.height,
    file_size: optimized.size,
  }

  const { data, error } = await admin
    .from('home_banners')
    .update(updatePayload)
    .eq('id', id)
    .select(BANNER_COLUMNS)
    .single()

  if (error || !data) {
    await admin.storage.from('banners').remove([storagePath])
    console.error('[banners/patch-image]', error?.message)
    return jsonError(
      error?.message
        ? `Não foi possível atualizar o banner: ${error.message}`
        : 'Não foi possível atualizar o banner',
      400
    )
  }

  if (existing.storage_path) {
    await admin.storage.from('banners').remove([existing.storage_path])
  }

  revalidatePath('/')
  return jsonSuccess(data, 'Banner atualizado')
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const { id } = paramsSchema.parse(await context.params)

  const supabase = await getWriteClient()
  const { data: existing, error: fetchError } = await supabase
    .from('home_banners')
    .select('storage_path')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return jsonError('Banner não encontrado', 404)
  }

  const { error } = await supabase.from('home_banners').delete().eq('id', id)

  if (error) {
    console.error('[banners/delete]', error.message)
    return jsonError(`Não foi possível remover o banner: ${error.message}`, 400)
  }

  if (existing.storage_path) {
    try {
      const admin = createAdminClient()
      await admin.storage.from('banners').remove([existing.storage_path])
    } catch {
      // Não bloqueia remoção do registro caso service role não esteja disponível.
    }
  }

  revalidatePath('/')
  return jsonSuccess({ ok: true }, 'Banner removido')
}
