import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { createCouponSchema } from '@/schemas/coupon-schema'

const COLUMNS = 'id, code, discount_type, discount_value, active, created_at, updated_at'

async function requireAdmin() {
  try {
    return await requireAdminUser()
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return jsonError('Não autorizado', 401, 'UNAUTHORIZED')
    }
    return jsonError('Acesso negado', 403, 'FORBIDDEN')
  }
}

export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('coupons')
    .select(COLUMNS)
    .order('created_at', { ascending: false })

  if (error) {
    return jsonError('Não foi possível carregar os cupons', 500)
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

  const parsed = createCouponSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Dados inválidos', 400)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('coupons')
    .insert({
      code: parsed.data.code,
      discount_type: parsed.data.discount_type,
      discount_value: parsed.data.discount_value,
      active: parsed.data.active,
      updated_at: new Date().toISOString(),
    })
    .select(COLUMNS)
    .single()

  if (error || !data) {
    if (error?.code === '23505') {
      return jsonError('Já existe um cupom com esse nome', 400)
    }
    return jsonError('Não foi possível criar o cupom', 400)
  }

  return jsonSuccess(data, 'Cupom criado', 201)
}
