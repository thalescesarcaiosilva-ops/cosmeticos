import { createPublicClient } from '@/lib/supabase/public'
import { calcBundlePricing } from '@/lib/products/buy-together'
import type { AppliedCartBundle, ValidatedCartLine } from '@/types/cart'

export type BundlePairCandidate = {
  primaryProductId: string
  companionProductId: string
  discountPercent: number
}

type LineQtyMap = Map<string, { line: ValidatedCartLine; remaining: number }>

function pairKey(a: string, b: string): string {
  return [a, b].sort().join(':')
}

export async function loadBundleCandidatesFromDb(
  productIds: string[]
): Promise<BundlePairCandidate[]> {
  if (productIds.length < 2) return []

  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('product_bundles')
    .select('primary_product_id, companion_product_id, discount_percent')
    .eq('active', true)
    .in('primary_product_id', productIds)
    .in('companion_product_id', productIds)

  if (error) {
    const code = (error as { code?: string }).code ?? ''
    if (code === '42P01' || error.message.includes('product_bundles')) {
      return []
    }
    return []
  }

  return (data ?? []).map((row) => ({
    primaryProductId: row.primary_product_id as string,
    companionProductId: row.companion_product_id as string,
    discountPercent: Number(row.discount_percent) || 5,
  }))
}

export function mergeBundleCandidates(
  dbCandidates: BundlePairCandidate[],
  clientCandidates: BundlePairCandidate[]
): BundlePairCandidate[] {
  const seen = new Set<string>()
  const merged: BundlePairCandidate[] = []

  for (const candidate of [...dbCandidates, ...clientCandidates]) {
    const key = pairKey(candidate.primaryProductId, candidate.companionProductId)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(candidate)
  }

  return merged.sort((a, b) => b.discountPercent - a.discountPercent)
}

export function applyBundleDiscountsToLines(
  lines: ValidatedCartLine[],
  candidates: BundlePairCandidate[]
): {
  bundleDiscountAmount: number
  appliedBundles: AppliedCartBundle[]
  lines: ValidatedCartLine[]
} {
  if (candidates.length === 0 || lines.length < 2) {
    return {
      bundleDiscountAmount: 0,
      appliedBundles: [],
      lines: lines.map((line) => ({
        ...line,
        bundleDiscountAmount: 0,
        displayLineTotal: line.lineTotal,
      })),
    }
  }

  const qtyMap: LineQtyMap = new Map()
  for (const line of lines) {
    if (!line.available || line.quantity <= 0) continue
    qtyMap.set(line.productId, { line, remaining: line.quantity })
  }

  const lineDiscounts = new Map<string, number>()
  const appliedBundles: AppliedCartBundle[] = []

  for (const candidate of candidates) {
    const primary = qtyMap.get(candidate.primaryProductId)
    const companion = qtyMap.get(candidate.companionProductId)
    if (!primary || !companion || primary.remaining <= 0 || companion.remaining <= 0) {
      continue
    }

    const pairCount = Math.min(primary.remaining, companion.remaining)
    if (pairCount <= 0) continue

    const { originalTotal, bundlePrice } = calcBundlePricing(
      primary.line.price,
      companion.line.price,
      candidate.discountPercent
    )
    const savingsPerPair = Math.round((originalTotal - bundlePrice) * 100) / 100
    const totalSavings = Math.round(savingsPerPair * pairCount * 100) / 100

    if (totalSavings <= 0) continue

    const priceSum = primary.line.price + companion.line.price
    const primaryShare =
      Math.round(((primary.line.price / priceSum) * totalSavings) * 100) / 100
    const companionShare = Math.round((totalSavings - primaryShare) * 100) / 100

    lineDiscounts.set(
      primary.line.productId,
      (lineDiscounts.get(primary.line.productId) ?? 0) + primaryShare
    )
    lineDiscounts.set(
      companion.line.productId,
      (lineDiscounts.get(companion.line.productId) ?? 0) + companionShare
    )

    primary.remaining -= pairCount
    companion.remaining -= pairCount

    appliedBundles.push({
      primaryProductId: candidate.primaryProductId,
      companionProductId: candidate.companionProductId,
      discountPercent: candidate.discountPercent,
      pairCount,
      savings: totalSavings,
    })
  }

  const updatedLines = lines.map((line) => {
    const bundleDiscountAmount = lineDiscounts.get(line.productId) ?? 0
    return {
      ...line,
      bundleDiscountAmount,
      displayLineTotal: Math.max(line.lineTotal - bundleDiscountAmount, 0),
    }
  })

  const bundleDiscountAmount = updatedLines.reduce(
    (sum, line) => sum + (line.bundleDiscountAmount ?? 0),
    0
  )

  return {
    bundleDiscountAmount: Math.round(bundleDiscountAmount * 100) / 100,
    appliedBundles,
    lines: updatedLines,
  }
}
