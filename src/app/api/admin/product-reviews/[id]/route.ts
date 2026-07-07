import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { reviewModerationSchema } from '@/schemas/product-review-schema'

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
  const adminUser = await requireAdmin()
  if (adminUser instanceof Response) return adminUser

  const { id } = paramsSchema.parse(await context.params)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = reviewModerationSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Dados inválidos', 400)
  }

  const admin = createAdminClient()
  const approvedAt = parsed.data.approved ? new Date().toISOString() : null
  const approvedBy = parsed.data.approved ? adminUser.id : null

  const { data, error } = await admin
    .from('product_reviews')
    .update({
      approved: parsed.data.approved,
      approved_at: approvedAt,
      approved_by: approvedBy,
    })
    .eq('id', id)
    .select('id, approved, approved_at, approved_by')
    .single()

  if (error || !data) {
    return jsonError('Não foi possível atualizar avaliação', 400)
  }

  return jsonSuccess(data, 'Avaliação atualizada')
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const { id } = paramsSchema.parse(await context.params)
  const admin = createAdminClient()

  const { error } = await admin.from('product_reviews').delete().eq('id', id)

  if (error) {
    return jsonError('Não foi possível remover avaliação', 400)
  }

  return jsonSuccess({ ok: true }, 'Avaliação removida')
}
