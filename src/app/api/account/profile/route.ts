import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { getSessionUser } from '@/lib/auth/verify-session'
import { profileUpdateSchema } from '@/schemas/profile-schema'

const PROFILE_COLUMNS = 'id, name, role, cpf, phone, created_at'

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return jsonError('Não autorizado', 401, 'UNAUTHORIZED')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', user.id)
    .single()

  if (error || !data) {
    return jsonError('Não foi possível carregar o perfil', 500)
  }

  return jsonSuccess({ ...data, email: user.email })
}

export async function PATCH(request: Request) {
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

  const parsed = profileUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Dados inválidos', 400)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .update(parsed.data)
    .eq('id', user.id)
    .select(PROFILE_COLUMNS)
    .single()

  if (error || !data) {
    return jsonError('Não foi possível atualizar o perfil', 400)
  }

  return jsonSuccess({ ...data, email: user.email }, 'Perfil atualizado')
}
