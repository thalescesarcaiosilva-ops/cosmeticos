'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react'
import {
  addStoredCartBundle,
  pruneStoredCartBundles,
  readStoredCartBundles,
  writeStoredCartBundles,
} from '@/lib/cart/bundle-storage'
import { readStoredCart, writeStoredCart } from '@/lib/cart/storage'
import type { StoredCartBundlePair, StoredCartItem } from '@/types/cart'

type CartState = {
  items: StoredCartItem[]
  hydrated: boolean
}

type CartAction =
  | { type: 'HYDRATE'; items: StoredCartItem[] }
  | { type: 'ADD'; productId: string; quantity: number }
  | { type: 'SET_QUANTITY'; productId: string; quantity: number }
  | { type: 'REMOVE'; productId: string }
  | { type: 'CLEAR' }
  | { type: 'SYNC_FROM_VALIDATED'; items: StoredCartItem[] }

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'HYDRATE':
      return { items: action.items, hydrated: true }

    case 'ADD': {
      const existing = state.items.find((i) => i.productId === action.productId)
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.productId === action.productId
              ? { ...i, quantity: Math.min(99, i.quantity + action.quantity) }
              : i
          ),
        }
      }
      if (state.items.length >= 50) return state
      return {
        ...state,
        items: [...state.items, { productId: action.productId, quantity: action.quantity }],
      }
    }

    case 'SET_QUANTITY': {
      if (action.quantity < 1) {
        return {
          ...state,
          items: state.items.filter((i) => i.productId !== action.productId),
        }
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.productId === action.productId
            ? { ...i, quantity: Math.min(99, action.quantity) }
            : i
        ),
      }
    }

    case 'REMOVE':
      return {
        ...state,
        items: state.items.filter((i) => i.productId !== action.productId),
      }

    case 'CLEAR':
      return { ...state, items: [] }

    case 'SYNC_FROM_VALIDATED':
      return { ...state, items: action.items }

    default:
      return state
  }
}

type CartContextValue = {
  items: StoredCartItem[]
  bundlePairs: StoredCartBundlePair[]
  hydrated: boolean
  itemCount: number
  addItem: (productId: string, quantity?: number) => void
  addBundlePair: (pair: StoredCartBundlePair) => void
  setQuantity: (productId: string, quantity: number) => void
  removeItem: (productId: string) => void
  clearCart: () => void
  syncValidatedItems: (items: StoredCartItem[]) => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], hydrated: false })
  const [bundlePairs, setBundlePairs] = useState<StoredCartBundlePair[]>([])

  useEffect(() => {
    dispatch({ type: 'HYDRATE', items: readStoredCart() })
    setBundlePairs(readStoredCartBundles())
  }, [])

  useEffect(() => {
    if (!state.hydrated) return
    writeStoredCart(state.items)
    pruneStoredCartBundles(state.items.map((item) => item.productId))
    setBundlePairs(readStoredCartBundles())
  }, [state.items, state.hydrated])

  const addItem = useCallback((productId: string, quantity = 1) => {
    dispatch({ type: 'ADD', productId, quantity })
  }, [])

  const setQuantity = useCallback((productId: string, quantity: number) => {
    dispatch({ type: 'SET_QUANTITY', productId, quantity })
  }, [])

  const addBundlePair = useCallback((pair: StoredCartBundlePair) => {
    addStoredCartBundle(pair)
    setBundlePairs(readStoredCartBundles())
  }, [])

  const removeItem = useCallback((productId: string) => {
    dispatch({ type: 'REMOVE', productId })
  }, [])

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR' })
    writeStoredCart([])
    writeStoredCartBundles([])
    setBundlePairs([])
  }, [])

  const syncValidatedItems = useCallback((items: StoredCartItem[]) => {
    dispatch({ type: 'SYNC_FROM_VALIDATED', items })
  }, [])

  const itemCount = useMemo(
    () => state.items.reduce((sum, item) => sum + item.quantity, 0),
    [state.items]
  )

  const value = useMemo(
    () => ({
      items: state.items,
      bundlePairs,
      hydrated: state.hydrated,
      itemCount,
      addItem,
      addBundlePair,
      setQuantity,
      removeItem,
      clearCart,
      syncValidatedItems,
    }),
    [
      state.items,
      bundlePairs,
      state.hydrated,
      itemCount,
      addItem,
      addBundlePair,
      setQuantity,
      removeItem,
      clearCart,
      syncValidatedItems,
    ]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) {
    throw new Error('useCart deve ser usado dentro de CartProvider')
  }
  return ctx
}
