import type { StoredCartBundlePair } from '@/types/cart'

const BUNDLE_STORAGE_KEY = 'loja-cart-bundles-v1'

export function readStoredCartBundles(): StoredCartBundlePair[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = localStorage.getItem(BUNDLE_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter(
        (item): item is StoredCartBundlePair =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as StoredCartBundlePair).primaryProductId === 'string' &&
          typeof (item as StoredCartBundlePair).companionProductId === 'string' &&
          typeof (item as StoredCartBundlePair).discountPercent === 'number'
      )
      .map((item) => ({
        primaryProductId: item.primaryProductId,
        companionProductId: item.companionProductId,
        discountPercent: Math.min(100, Math.max(0, item.discountPercent)),
      }))
  } catch {
    return []
  }
}

export function writeStoredCartBundles(pairs: StoredCartBundlePair[]): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(BUNDLE_STORAGE_KEY, JSON.stringify(pairs))
  } catch {
    // quota ou modo privado — ignora
  }
}

export function addStoredCartBundle(pair: StoredCartBundlePair): void {
  const existing = readStoredCartBundles()
  const key = [pair.primaryProductId, pair.companionProductId].sort().join(':')
  const next = existing.filter(
    (item) => [item.primaryProductId, item.companionProductId].sort().join(':') !== key
  )
  next.push(pair)
  writeStoredCartBundles(next)
}

export function pruneStoredCartBundles(productIds: string[]): void {
  const idSet = new Set(productIds)
  const next = readStoredCartBundles().filter(
    (pair) => idSet.has(pair.primaryProductId) && idSet.has(pair.companionProductId)
  )
  writeStoredCartBundles(next)
}
