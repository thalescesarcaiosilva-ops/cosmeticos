import {
  applyBundleDiscountsToLines,
  loadBundleCandidatesFromDb,
  mergeBundleCandidates,
  type BundlePairCandidate,
} from '@/lib/cart/apply-bundle-discounts'
import { createPublicClient } from '@/lib/supabase/public'
import { getPrimaryProductImage } from '@/lib/products/product-images'
import type { CartSyncInput } from '@/schemas/cart-schema'
import type { CartSyncResult, ValidatedCartLine } from '@/types/cart'

const CART_PRODUCT_SELECT = `
  id, name, slug, price, original_price, stock, active,
  product_images(sort_order, media:media_assets(public_url, alt_text))
`

type ProductRow = {
  id: string
  name: string
  slug: string
  price: number
  original_price: number | null
  stock: number
  active: boolean
  product_images?: unknown
}

export async function syncCartItems(input: CartSyncInput): Promise<CartSyncResult> {
  const warnings: string[] = []
  const lines: ValidatedCartLine[] = []

  if (input.items.length === 0) {
    return {
      lines: [],
      subtotal: 0,
      bundleDiscountAmount: 0,
      appliedBundles: [],
      merchandiseTotal: 0,
      itemCount: 0,
      warnings: [],
    }
  }

  const supabase = createPublicClient()
  const ids = input.items.map((i) => i.product_id)

  const { data, error } = await supabase
    .from('products')
    .select(CART_PRODUCT_SELECT)
    .in('id', ids)
    .eq('active', true)

  if (error) {
    throw new Error('Erro ao validar carrinho')
  }

  const productMap = new Map<string, ProductRow>(
    (data ?? []).map((row) => [row.id, row as ProductRow])
  )

  for (const item of input.items) {
    const product = productMap.get(item.product_id)

    if (!product || !product.active) {
      warnings.push('Um produto não está mais disponível e foi removido do carrinho.')
      continue
    }

    const image = getPrimaryProductImage(product.product_images, product.name)
    let quantity = item.quantity
    let quantityAdjusted = false

    if (product.stock <= 0) {
      warnings.push(`${product.name} está indisponível no momento.`)
      lines.push({
        productId: product.id,
        slug: product.slug,
        name: product.name,
        price: Number(product.price),
        originalPrice:
          product.original_price != null ? Number(product.original_price) : null,
        stock: product.stock,
        quantity,
        lineTotal: 0,
        imageUrl: image.url,
        imageAlt: image.alt ?? product.name,
        available: false,
        quantityAdjusted: false,
      })
      continue
    }

    if (quantity > product.stock) {
      quantity = product.stock
      quantityAdjusted = true
      warnings.push(
        `A quantidade de ${product.name} foi ajustada para ${quantity} (estoque disponível).`
      )
    }

    const price = Number(product.price)
    lines.push({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price,
      originalPrice:
        product.original_price != null ? Number(product.original_price) : null,
      stock: product.stock,
      quantity,
      lineTotal: price * quantity,
      imageUrl: image.url,
      imageAlt: image.alt ?? product.name,
      available: true,
      quantityAdjusted,
    })
  }

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0)
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0)

  const productIds = lines.map((line) => line.productId)
  const dbCandidates = await loadBundleCandidatesFromDb(productIds)
  const clientCandidates: BundlePairCandidate[] =
    input.bundle_pairs?.map((pair) => ({
      primaryProductId: pair.primary_product_id,
      companionProductId: pair.companion_product_id,
      discountPercent: pair.discount_percent,
    })) ?? []

  const bundleResult = applyBundleDiscountsToLines(
    lines,
    mergeBundleCandidates(dbCandidates, clientCandidates)
  )

  const merchandiseTotal = Math.max(subtotal - bundleResult.bundleDiscountAmount, 0)

  return {
    lines: bundleResult.lines,
    subtotal,
    bundleDiscountAmount: bundleResult.bundleDiscountAmount,
    appliedBundles: bundleResult.appliedBundles,
    merchandiseTotal,
    itemCount,
    warnings,
  }
}
