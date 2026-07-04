import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { updateBrandSchema } from '@/schemas/product-schema'

const paramsSchema = z.object({ id: z.string().uuid() })
const BRAND_COLUMNS = 'id, name, slug, active, created_at'

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

  const parsed = updateBrandSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Dados inválidos', 400)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('brands')
    .update(parsed.data)
    .eq('id', id)
    .select(BRAND_COLUMNS)
    .single()

  if (error || !data) {
    return jsonError('Não foi possível atualizar a marca', 400)
  }

  return jsonSuccess(data, 'Marca atualizada')
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const { id } = paramsSchema.parse(await context.params)

  const supabase = await createClient()
  const { error } = await supabase.from('brands').delete().eq('id', id)

  if (error) {
    return jsonError('Não foi possível remover a marca', 400)
  }

  return jsonSuccess({ ok: true }, 'Marca removida')
}
