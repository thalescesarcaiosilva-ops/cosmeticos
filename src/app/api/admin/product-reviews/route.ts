import { createAdminClient } from '@/lib/supabase/admin'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'

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

export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('product_id')
  const status = searchParams.get('status') ?? 'all'
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(searchParams.get('pageSize') ?? '20', 10) || 20)
  )
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const admin = createAdminClient()
  let query = admin
    .from('product_reviews')
    .select(
      'id, product_id, author_name, author_email, rating, title, comment, approved, imported_from_csv, created_at, products(name)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (productId) {
    query = query.eq('product_id', productId)
  }
  if (status === 'approved') {
    query = query.eq('approved', true)
  } else if (status === 'pending') {
    query = query.eq('approved', false)
  }

  const { data, error, count } = await query

  if (error) {
    if (error.code === '42P01') {
      return jsonError('Aplique a migration de avaliações no Supabase.', 503)
    }
    return jsonError('Não foi possível carregar avaliações', 500)
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
