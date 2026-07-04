import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { createMenuItemSchema } from '@/schemas/menu-item-schema'

const MENU_ITEM_COLUMNS =
  'id, label, slug, href, parent_id, has_dropdown, sort_order, visible, created_at'

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
    .from('menu_items')
    .select(MENU_ITEM_COLUMNS)
    .order('sort_order', { ascending: true })

  if (error) {
    return jsonError('Não foi possível carregar o menu', 500)
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

  const parsed = createMenuItemSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Dados inválidos', 400)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('menu_items')
    .insert(parsed.data)
    .select(MENU_ITEM_COLUMNS)
    .single()

  if (error || !data) {
    return jsonError('Não foi possível criar o item do menu', 400)
  }

  revalidateTag('site-layout', 'max')

  return jsonSuccess(data, 'Item do menu criado', 201)
}
