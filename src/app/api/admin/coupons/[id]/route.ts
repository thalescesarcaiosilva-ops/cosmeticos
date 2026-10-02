import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { quoteCouponDiscount } from '@/lib/checkout/coupon-math'
import { updateCouponSchema } from '@/schemas/coupon-schema'

const COLUMNS = 'id, code, discount_type, discount_value, active, created_at, updated_at'

type RouteContext = { params: Promise<{ id: string }> }

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

  const parsed = updateCouponSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Dados inválidos', 400)
  }

  const supabase = await createClient()
  const { data: current, error: readError } = await supabase
    .from('coupons')
    .select('discount_type, discount_value')
    .eq('id', id)
    .maybeSingle()

  if (readError || !current) {
    return jsonError('Cupom não encontrado', 404)
  }

  const discountType = parsed.data.discount_type ?? current.discount_type
  const discountValue = parsed.data.discount_value ?? Number(current.discount_value)
  if (discountType !== 'percent' && discountType !== 'fixed') {
    return jsonError('Dados inválidos', 400)
  }
  if (quoteCouponDiscount({ discountType, discountValue, merchandiseTotal: 1 }) < 0) {
    return jsonError('Dados inválidos', 400)
  }
  if (discountType === 'percent' && discountValue > 100) {
    return jsonError('A porcentagem deve ser de até 100', 400)
  }
  if (discountValue <= 0) {
    return jsonError('Informe um desconto maior que zero', 400)
  }

  const patch: {
    code?: string
    discount_type: 'percent' | 'fixed'
    discount_value: number
    active?: boolean
    updated_at: string
  } = {
    discount_type: discountType,
    discount_value: discountValue,
    updated_at: new Date().toISOString(),
  }
  if (parsed.data.code) patch.code = parsed.data.code
  if (parsed.data.active !== undefined) patch.active = parsed.data.active

  const { data, error } = await supabase
    .from('coupons')
    .update(patch)
    .eq('id', id)
    .select(COLUMNS)
    .single()

  if (error || !data) {
    if (error?.code === '23505') {
      return jsonError('Já existe um cupom com esse nome', 400)
    }
    return jsonError('Não foi possível atualizar o cupom', 400)
  }

  return jsonSuccess(data, 'Cupom atualizado')
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) {
    return jsonError('Dados inválidos', 400)
  }

  const supabase = await createClient()
  const { error } = await supabase.from('coupons').delete().eq('id', id)
  if (error) {
    return jsonError('Não foi possível excluir o cupom', 400)
  }

  return jsonSuccess({ id }, 'Cupom excluído')
}
