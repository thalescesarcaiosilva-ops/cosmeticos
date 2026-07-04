import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { PRODUCT_SELECT, syncProductRelations } from '@/lib/products/queries'
import { createProductSchema } from '@/schemas/product-schema'

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

function pickProductFields(data: ReturnType<typeof createProductSchema.parse>) {
  const { category_ids: _c, media_ids: _m, ...fields } = data
  return fields
}

export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .order('created_at', { ascending: false })

  if (error) {
    return jsonError('Não foi possível carregar os produtos', 500)
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

  const parsed = createProductSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Dados inválidos', 400)
  }

  const { category_ids, media_ids } = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .insert(pickProductFields(parsed.data))
    .select('id')
    .single()

  if (error || !data) {
    return jsonError('Não foi possível criar o produto', 400)
  }

  await syncProductRelations(data.id, category_ids ?? [], media_ids ?? [])

  const { data: full } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('id', data.id)
    .single()

  return jsonSuccess(full, 'Produto criado', 201)
}
