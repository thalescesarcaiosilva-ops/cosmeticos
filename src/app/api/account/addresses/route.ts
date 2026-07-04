import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { getSessionUser } from '@/lib/auth/verify-session'
import { createAddressSchema } from '@/schemas/address-schema'

const ADDRESS_COLUMNS =
  'id, label, street, number, complement, neighborhood, city, state, zip_code, is_default, created_at'

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return jsonError('Não autorizado', 401, 'UNAUTHORIZED')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('addresses')
    .select(ADDRESS_COLUMNS)
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return jsonError('Não foi possível carregar os endereços', 500)
  }

  return jsonSuccess(data ?? [])
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return jsonError('Não autorizado', 401, 'UNAUTHORIZED')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = createAddressSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Dados inválidos', 400)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('addresses')
    .insert({ ...parsed.data, user_id: user.id })
    .select(ADDRESS_COLUMNS)
    .single()

  if (error || !data) {
    return jsonError('Não foi possível criar o endereço', 400)
  }

  return jsonSuccess(data, 'Endereço criado', 201)
}
