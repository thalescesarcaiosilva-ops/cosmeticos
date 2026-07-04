import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { createShippingMethodSchema } from '@/schemas/shipping-schema'

const COLUMNS =
  'id, name, description, base_price, free_above, estimated_days_min, estimated_days_max, cep_rules, sort_order, active, created_at, updated_at'

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

export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('shipping_methods')
    .select(COLUMNS)
    .order('sort_order', { ascending: true })

  if (error) {
    return jsonError(
      'Não foi possível carregar formas de frete. Execute PARTE_13_shipping_methods.sql.',
      500
    )
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

  const parsed = createShippingMethodSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Dados inválidos', 400)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('shipping_methods')
    .insert({
      ...parsed.data,
      cep_rules: parsed.data.cep_rules ?? [],
    })
    .select(COLUMNS)
    .single()

  if (error || !data) {
    return jsonError('Não foi possível criar a forma de frete', 400)
  }

  revalidateTag('site-layout', 'max')

  return jsonSuccess(data, 'Forma de frete criada', 201)
}
