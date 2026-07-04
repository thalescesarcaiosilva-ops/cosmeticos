import { createClient } from '@/lib/supabase/server'
import { createPublicClient } from '@/lib/supabase/public'
import { mapProductCard, PRODUCT_SELECT } from '@/lib/products/queries'
import type { ProductCardData } from '@/types/product'

export async function getFavoriteProductIds(userId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('product_favorites')
    .select('product_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data.map((row) => row.product_id as string)
}

export async function getProductsByIds(productIds: string[]): Promise<ProductCardData[]> {
  const uniqueIds = [...new Set(productIds.filter(Boolean))]
  if (uniqueIds.length === 0) return []

  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('active', true)
    .in('id', uniqueIds)

  if (error || !data) return []

  const byId = new Map(
    data.map((row) => {
      const card = mapProductCard(row as Record<string, unknown>)
      return [card.id, card] as const
    })
  )

  return uniqueIds.map((id) => byId.get(id)).filter((p): p is ProductCardData => Boolean(p))
}

export async function syncFavoriteProductIds(
  userId: string,
  productIds: string[]
): Promise<string[]> {
  const supabase = await createClient()
  const uniqueIds = [...new Set(productIds.filter(Boolean))].slice(0, 100)

  const { data: existing, error: readError } = await supabase
    .from('product_favorites')
    .select('product_id')
    .eq('user_id', userId)

  if (readError) return uniqueIds

  const existingIds = new Set((existing ?? []).map((row) => row.product_id as string))
  const merged = [...new Set([...existingIds, ...uniqueIds])]

  const toInsert = merged.filter((id) => !existingIds.has(id))
  if (toInsert.length > 0) {
    await supabase.from('product_favorites').upsert(
      toInsert.map((product_id) => ({ user_id: userId, product_id })),
      { onConflict: 'user_id,product_id', ignoreDuplicates: true }
    )
  }

  return merged
}

export async function addFavorite(userId: string, productId: string): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase.from('product_favorites').upsert(
    { user_id: userId, product_id: productId },
    { onConflict: 'user_id,product_id', ignoreDuplicates: true }
  )

  return !error
}

export async function removeFavorite(userId: string, productId: string): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('product_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId)

  return !error
}
