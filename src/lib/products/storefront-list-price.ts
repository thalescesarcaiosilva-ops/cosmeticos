import { createAdminClient } from '@/lib/supabase/admin'
import type { ProductCardData } from '@/types/product'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Preço riscado só entra na vitrine quando é maior que o de venda e o produto já teve pedido. */
export function visibleListPrice(
  price: number,
  originalPrice: number | null | undefined,
  hasOrder: boolean
): number | null {
  const sale = Number(price)
  const list = originalPrice == null ? null : Number(originalPrice)
  if (!hasOrder || list == null || !Number.isFinite(list) || !Number.isFinite(sale) || list <= sale) {
    return null
  }
  return list
}

/**
 * Devolve só o id do produto que já aparece em algum item de pedido.
 * A consulta fica no servidor (service role) e não lê nome, contato, valor ou status.
 */
export async function fetchOrderedProductIds(productIds: string[]): Promise<Set<string>> {
  const wanted = [...new Set(productIds.filter((id) => UUID_RE.test(id)))]
  if (wanted.length === 0) return new Set()
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return new Set()

  const admin = createAdminClient()
  const found = new Set<string>()
  const chunkSize = 80
  const pageSize = 1000

  for (let offset = 0; offset < wanted.length; offset += chunkSize) {
    const chunk = wanted.slice(offset, offset + chunkSize)
    for (let from = 0; found.size < wanted.length; from += pageSize) {
      const { data, error } = await admin
        .from('order_items')
        .select('product_id')
        .in('product_id', chunk)
        .not('product_id', 'is', null)
        .range(from, from + pageSize - 1)

      if (error || !data || data.length === 0) break
      for (const row of data) {
        if (typeof row.product_id === 'string') found.add(row.product_id)
      }
      if (data.length < pageSize) break
    }
  }

  return found
}

export async function maskStorefrontListPrices(
  products: ProductCardData[]
): Promise<ProductCardData[]> {
  if (products.length === 0) return products
  const ordered = await fetchOrderedProductIds(products.map((product) => product.id))
  return products.map((product) => ({
    ...product,
    originalPrice: visibleListPrice(product.price, product.originalPrice, ordered.has(product.id)),
  }))
}

export async function storefrontListPrice(
  productId: string,
  price: number,
  originalPrice: number | null
): Promise<number | null> {
  const ordered = await fetchOrderedProductIds([productId])
  return visibleListPrice(price, originalPrice, ordered.has(productId))
}
