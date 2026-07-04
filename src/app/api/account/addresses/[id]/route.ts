import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { getSessionUser } from '@/lib/auth/verify-session'
import { updateAddressSchema } from '@/schemas/address-schema'

const ADDRESS_COLUMNS =
  'id, label, street, number, complement, neighborhood, city, state, zip_code, is_default, created_at'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser()
  if (!user) {
    return jsonError('Não autorizado', 401, 'UNAUTHORIZED')
  }

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

  const parsed = updateAddressSchema.safeParse(body)
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return jsonError('Dados inválidos', 400)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('addresses')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', user.id)
    .select(ADDRESS_COLUMNS)
    .single()

  if (error || !data) {
    return jsonError('Não foi possível atualizar o endereço', 400)
  }

  return jsonSuccess(data, 'Endereço atualizado')
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getSessionUser()
  if (!user) {
    return jsonError('Não autorizado', 401, 'UNAUTHORIZED')
  }

  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) {
    return jsonError('Dados inválidos', 400)
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('addresses')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return jsonError('Não foi possível remover o endereço', 400)
  }

  return jsonSuccess({ ok: true }, 'Endereço removido')
}
