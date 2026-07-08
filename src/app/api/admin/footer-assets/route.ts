import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { toSiteMediaUrl } from '@/lib/media/public-url'
import { createFooterAssetSchema } from '@/schemas/footer-asset-schema'

const FOOTER_ASSET_COLUMNS =
  'id, asset_type, image_url, alt_text, href, sort_order, active, created_at'

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

export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(request.url)
  const assetType = searchParams.get('type')

  const supabase = await createClient()
  let query = supabase
    .from('footer_assets')
    .select(FOOTER_ASSET_COLUMNS)
    .order('sort_order', { ascending: true })

  if (assetType === 'payment' || assetType === 'security') {
    query = query.eq('asset_type', assetType)
  }

  const { data, error } = await query

  if (error) {
    return jsonError(
      'Não foi possível carregar os ícones. Execute PARTE_12_footer_system.sql no Supabase.',
      500
    )
  }

  return jsonSuccess(
    (data ?? []).map((asset) => ({
      ...asset,
      image_url: toSiteMediaUrl(asset.image_url) ?? asset.image_url,
    }))
  )
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = createFooterAssetSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Dados inválidos', 400)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('footer_assets')
    .insert(parsed.data)
    .select(FOOTER_ASSET_COLUMNS)
    .single()

  if (error || !data) {
    return jsonError('Não foi possível criar o ícone do rodapé', 400)
  }

  revalidateTag('site-layout', 'max')

  return jsonSuccess(
    {
      ...data,
      image_url: toSiteMediaUrl(data.image_url) ?? data.image_url,
    },
    'Ícone adicionado',
    201
  )
}
