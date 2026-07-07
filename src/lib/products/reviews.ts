import { createClient } from '@/lib/supabase/server'

export type ApprovedProductReview = {
  id: string
  author_name: string
  rating: number
  title: string | null
  comment: string
  created_at: string
}

export async function getApprovedProductReviews(
  productId: string,
  limit = 20
): Promise<ApprovedProductReview[]> {
  const supabase = await createClient()
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

export function buildReviewSummary(reviews: ApprovedProductReview[]) {
  const count = reviews.length
  if (count === 0) return { average: 0, count: 0 }
  const total = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0)
  return {
    average: Number((total / count).toFixed(1)),
    count,
  }
}
