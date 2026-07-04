const FAVORITES_STORAGE_KEY = 'loja-favorites-v1'

export function readStoredFavorites(): string[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return [...new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0))]
  } catch {
    return []
  }
}

export function writeStoredFavorites(productIds: string[]): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(productIds))
  } catch {
    // quota ou modo privado
  }
}

export function clearStoredFavorites(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(FAVORITES_STORAGE_KEY)
  } catch {
    // ignore
  }
}
