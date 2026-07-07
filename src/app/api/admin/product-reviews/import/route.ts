import { createAdminClient } from '@/lib/supabase/admin'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { importProductReviewsSchema } from '@/schemas/product-review-schema'

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

export async function POST(request: Request) {
  const adminUser = await requireAdmin()
  if (adminUser instanceof Response) return adminUser

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = importProductReviewsSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Dados inválidos', 400)
  }

  const now = new Date().toISOString()
  const rows = parsed.data.rows.map((row) => ({
    product_id: parsed.data.product_id,
    author_name: row.authorName,
    author_email: row.authorEmail,
    rating: row.rating,
    title: row.title,
    comment: row.comment,
    approved: true,
    imported_from_csv: true,
    approved_at: now,
    approved_by: adminUser.id,
  }))

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('product_reviews')
    .insert(rows)
    .select('id')

  if (error) {
    if (error.code === '42P01') {
      return jsonError('Aplique a migration de avaliações no Supabase.', 503)
    }
    return jsonError('Não foi possível importar avaliações', 400)
  }

  return jsonSuccess(
    { imported: data?.length ?? 0 },
    `${data?.length ?? 0} avaliações importadas e aprovadas`
  )
}
