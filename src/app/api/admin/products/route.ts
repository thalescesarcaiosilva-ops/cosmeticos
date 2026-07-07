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
  const fields = { ...data }
  delete fields.category_ids
  delete fields.media_ids
  return fields
}

export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const searchParams = new URL(request.url).searchParams
  const query = searchParams.get('q')?.trim() ?? ''
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(searchParams.get('pageSize') ?? '20', 10) || 20)
  )
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const supabase = await createClient()
  let dbQuery = supabase
    .from('products')
    .select(PRODUCT_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (query) {
    dbQuery = dbQuery.ilike('name', `%${query}%`)
  }

  const { data, error, count } = await dbQuery

  if (error) {
    return jsonError('Não foi possível carregar os produtos', 500)
  }

  const total = count ?? 0
  return jsonSuccess({
    items: data ?? [],
    total,
    page,
    pageSize,
    totalPages: total > 0 ? Math.ceil(total / pageSize) : 1,
  })
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
