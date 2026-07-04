import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { updateFooterMenuSchema } from '@/schemas/footer-menu-schema'

const MENU_COLUMNS = 'id, title, sort_order, active, created_at, updated_at'

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

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const { id } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = updateFooterMenuSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Dados inválidos', 400)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('footer_menus')
    .update(parsed.data)
    .eq('id', id)
    .select(MENU_COLUMNS)
    .single()

  if (error || !data) {
    return jsonError('Não foi possível atualizar o menu', 400)
  }

  revalidateTag('site-layout', 'max')
  return jsonSuccess(data, 'Menu atualizado')
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const { id } = await context.params
  const supabase = await createClient()

  const { error } = await supabase.from('footer_menus').delete().eq('id', id)

  if (error) {
    return jsonError('Não foi possível remover o menu', 400)
  }

  revalidateTag('site-layout', 'max')
  return jsonSuccess({ ok: true }, 'Menu removido')
}
