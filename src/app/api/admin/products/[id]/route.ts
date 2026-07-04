import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { PRODUCT_SELECT, syncProductRelations } from '@/lib/products/queries'
import { updateProductSchema } from '@/schemas/product-schema'

const paramsSchema = z.object({ id: z.string().uuid() })

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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = updateProductSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Dados inválidos', 400)
  }

  const { category_ids, media_ids, ...fields } = parsed.data

  const supabase = await createClient()
  if (Object.keys(fields).length > 0) {
    const { error } = await supabase.from('products').update(fields).eq('id', id)
    if (error) {
      return jsonError('Não foi possível atualizar o produto', 400)
    }
  }

  await syncProductRelations(id, category_ids, media_ids)

  const { data, error: fetchError } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('id', id)
    .single()

  if (fetchError || !data) {
    return jsonError('Produto não encontrado', 404)
  }

  return jsonSuccess(data, 'Produto atualizado')
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const { id } = paramsSchema.parse(await context.params)

  const supabase = await createClient()
  const { error } = await supabase.from('products').delete().eq('id', id)

  if (error) {
    return jsonError('Não foi possível remover o produto', 400)
  }

  return jsonSuccess({ ok: true }, 'Produto removido')
}
