import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { updateFooterPageSchema } from '@/schemas/footer-page-schema'

const FOOTER_PAGE_COLUMNS =
  'id, slug, title, content, page_type, sort_order, show_in_footer, meta_description, active, created_at, updated_at'

type RouteContext = { params: Promise<{ id: string }> }

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

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) {
    return jsonError('Dados inválidos', 400)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = updateFooterPageSchema.safeParse(body)
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return jsonError('Dados inválidos', 400)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('footer_pages')
    .update(parsed.data)
    .eq('id', id)
    .select(FOOTER_PAGE_COLUMNS)
    .single()

  if (error || !data) {
    return jsonError('Não foi possível atualizar a página do rodapé', 400)
  }

  revalidateTag('site-layout', 'max')

  return jsonSuccess(data, 'Página do rodapé atualizada')
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) {
    return jsonError('Dados inválidos', 400)
  }

  const supabase = await createClient()
  const { error } = await supabase.from('footer_pages').delete().eq('id', id)

  if (error) {
    return jsonError('Não foi possível remover a página do rodapé', 400)
  }

  revalidateTag('site-layout', 'max')

  return jsonSuccess({ ok: true }, 'Página do rodapé removida')
}
