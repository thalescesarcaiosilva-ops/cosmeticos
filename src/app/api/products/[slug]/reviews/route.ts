import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { createProductReviewSchema } from '@/schemas/product-review-schema'

const paramsSchema = z.object({ slug: z.string().min(1) })

const createReviewBySlugSchema = createProductReviewSchema.omit({ product_id: true })

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = paramsSchema.parse(await context.params)
  const supabase = await createClient()

  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle()

  if (!product) {
    return jsonError('Produto não encontrado', 404)
  }

  const { data, error } = await supabase
    .from('product_reviews')
    .select('id, author_name, rating, title, comment, created_at')
    .eq('product_id', product.id)
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return jsonError('Não foi possível carregar avaliações', 500)
  }

  const count = data?.length ?? 0
  const average =
    count === 0 ? 0 : Number(((data ?? []).reduce((sum, item) => sum + Number(item.rating), 0) / count).toFixed(1))

  return jsonSuccess({
    average,
    count,
    items: data ?? [],
  })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = paramsSchema.parse(await context.params)
  const supabase = await createClient()

  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle()

  if (!product) {
    return jsonError('Produto não encontrado', 404)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = createReviewBySlugSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Dados inválidos', 400)
  }

  const payload = {
    product_id: product.id,
    author_name: parsed.data.author_name,
    author_email: parsed.data.author_email ?? null,
    rating: parsed.data.rating,
    title: parsed.data.title ?? null,
    comment: parsed.data.comment,
    approved: false,
    imported_from_csv: false,
  }

  const { error } = await supabase.from('product_reviews').insert(payload)

  if (error) {
    if (error.code === '42P01') {
      return jsonError('Sistema de avaliações não configurado.', 503)
    }
    return jsonError('Não foi possível enviar avaliação', 400)
  }

  return jsonSuccess(
    { ok: true },
    'Avaliação enviada. Ela será publicada após aprovação.',
    201
  )
}
