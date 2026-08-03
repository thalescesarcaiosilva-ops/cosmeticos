import { createPublicClient } from '@/lib/supabase/public'
import type { ProductCardData } from '@/types/product'

export type ApprovedProductReview = {
  id: string
  author_name: string
  rating: number
  title: string | null
  comment: string
  created_at: string
}

export type ReviewSummary = {
  average: number
  count: number
}

export async function getApprovedProductReviews(
  productId: string,
  limit = 20
): Promise<ApprovedProductReview[]> {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('product_reviews')
    .select('id, author_name, rating, title, comment, created_at')
    .eq('product_id', productId)
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data
}

export function buildReviewSummary(reviews: ApprovedProductReview[]): ReviewSummary {
  const count = reviews.length
  if (count === 0) return { average: 0, count: 0 }
  const total = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0)
  return {
    average: Number((total / count).toFixed(1)),
    count,
  }
}

/** Agrega média e contagem de avaliações aprovadas por produto. */
export async function getReviewSummariesByProductIds(
  productIds: string[]
): Promise<Map<string, ReviewSummary>> {
  const uniqueIds = [...new Set(productIds.filter(Boolean))]
  const summaries = new Map<string, ReviewSummary>()
  if (uniqueIds.length === 0) return summaries

  const supabase = createPublicClient()
  const totals = new Map<string, { sum: number; count: number }>()

  // PostgREST limita OR/IN; busca em lotes
  for (let i = 0; i < uniqueIds.length; i += 100) {
    const chunk = uniqueIds.slice(i, i + 100)
    const { data, error } = await supabase
      .from('product_reviews')
      .select('product_id, rating')
      .in('product_id', chunk)
      .eq('approved', true)

    if (error || !data) continue

    for (const row of data) {
      const id = row.product_id as string
      const current = totals.get(id) ?? { sum: 0, count: 0 }
      current.sum += Number(row.rating) || 0
      current.count += 1
      totals.set(id, current)
    }
  }

  for (const [id, { sum, count }] of totals) {
    summaries.set(id, {
      average: count > 0 ? Number((sum / count).toFixed(1)) : 0,
      count,
    })
  }

  return summaries
}

export async function attachReviewSummaries(
  products: ProductCardData[]
): Promise<ProductCardData[]> {
  if (products.length === 0) return products
  const summaries = await getReviewSummariesByProductIds(products.map((p) => p.id))
  return products.map((product) => {
    const summary = summaries.get(product.id)
    return {
      ...product,
      ratingAverage: summary?.average ?? 0,
      ratingCount: summary?.count ?? 0,
    }
  })
}
