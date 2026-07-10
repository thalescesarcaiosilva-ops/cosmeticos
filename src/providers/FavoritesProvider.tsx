'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  clearStoredFavorites,
  readStoredFavorites,
  writeStoredFavorites,
} from '@/lib/favorites/storage'

type FavoritesContextValue = {
  favoriteIds: Set<string>
  hydrated: boolean
  isLoggedIn: boolean
  isFavorite: (productId: string) => boolean
  toggleFavorite: (productId: string) => Promise<void>
  favoriteCount: number
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [hydrated, setHydrated] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      const localIds = readStoredFavorites()

      try {
        const res = await fetch('/api/account/favorites')
        const json = (await res.json()) as {
          error?: boolean
          data?: { loggedIn?: boolean; productIds?: string[] }
        }

        if (json.error || !json.data) {
          if (!cancelled) {
            setFavoriteIds(new Set(localIds))
            setHydrated(true)
          }
          return
        }

        if (!json.data.loggedIn) {
          if (!cancelled) {
            setFavoriteIds(new Set(localIds))
            setIsLoggedIn(false)
            setHydrated(true)
          }
          return
        }

        let serverIds = json.data.productIds ?? []

        if (localIds.length > 0) {
          const syncRes = await fetch('/api/account/favorites', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productIds: localIds }),
          })
          const syncJson = (await syncRes.json()) as {
            data?: { productIds?: string[] }
          }
          if (syncJson.data?.productIds) {
            serverIds = syncJson.data.productIds
          }
          clearStoredFavorites()
        }

        if (!cancelled) {
          setFavoriteIds(new Set(serverIds))
          setIsLoggedIn(true)
          setHydrated(true)
        }
      } catch {
        if (!cancelled) {
          setFavoriteIds(new Set(localIds))
          setHydrated(true)
        }
      }
    }

    hydrate()
    return () => {
      cancelled = true
    }
  }, [])

  const persistGuest = useCallback((ids: Set<string>) => {
    writeStoredFavorites([...ids])
  }, [])

  const toggleFavorite = useCallback(
    async (productId: string) => {
      const next = new Set(favoriteIds)
      const adding = !next.has(productId)
      if (adding) next.add(productId)
      else next.delete(productId)

      setFavoriteIds(next)

      if (isLoggedIn) {
        try {
          await fetch('/api/account/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, action: adding ? 'add' : 'remove' }),
          })
        } catch {
          setFavoriteIds(favoriteIds)
        }
        return
      }

      persistGuest(next)
    },
    [favoriteIds, isLoggedIn, persistGuest]
  )

  const isFavorite = useCallback(
    (productId: string) => favoriteIds.has(productId),
    [favoriteIds]
  )

  const value = useMemo(
    () => ({
      favoriteIds,
      hydrated,
      isLoggedIn,
      isFavorite,
      toggleFavorite,
      favoriteCount: favoriteIds.size,
    }),
    [favoriteIds, hydrated, isLoggedIn, isFavorite, toggleFavorite]
  )

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) {
    throw new Error('useFavorites deve ser usado dentro de FavoritesProvider')
  }
  return ctx
}
