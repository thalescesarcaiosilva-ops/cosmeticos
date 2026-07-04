import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { updateShippingMethodSchema } from '@/schemas/shipping-schema'

const COLUMNS =
  'id, name, description, base_price, free_above, estimated_days_min, estimated_days_max, cep_rules, sort_order, active, created_at, updated_at'

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

  const parsed = updateShippingMethodSchema.safeParse(body)
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return jsonError('Dados inválidos', 400)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('shipping_methods')
    .update(parsed.data)
    .eq('id', id)
    .select(COLUMNS)
    .single()

  if (error || !data) {
    return jsonError('Não foi possível atualizar a forma de frete', 400)
  }

  revalidateTag('site-layout', 'max')

  return jsonSuccess(data, 'Forma de frete atualizada')
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) {
    return jsonError('Dados inválidos', 400)
  }

  const supabase = await createClient()
  const { error } = await supabase.from('shipping_methods').delete().eq('id', id)

  if (error) {
    return jsonError('Não foi possível remover a forma de frete', 400)
  }

  revalidateTag('site-layout', 'max')

  return jsonSuccess({ ok: true }, 'Forma de frete removida')
}
