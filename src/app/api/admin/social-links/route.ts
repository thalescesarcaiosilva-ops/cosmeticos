import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { createSocialLinkSchema } from '@/schemas/social-link-schema'

const SOCIAL_LINK_COLUMNS =
  'id, type, href, label, display, sort_order, active, created_at'

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

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('social_links')
    .select(SOCIAL_LINK_COLUMNS)
    .order('sort_order', { ascending: true })

  if (error) {
    return jsonError('Não foi possível carregar os links sociais', 500)
  }

  return jsonSuccess(data ?? [])
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

  const parsed = createSocialLinkSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Dados inválidos', 400)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('social_links')
    .insert(parsed.data)
    .select(SOCIAL_LINK_COLUMNS)
    .single()

  if (error || !data) {
    return jsonError('Não foi possível criar o link social', 400)
  }

  revalidateTag('site-layout', 'max')

  return jsonSuccess(data, 'Link social criado', 201)
}
