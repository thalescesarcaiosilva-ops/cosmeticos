'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import { readStoredCart, writeStoredCart } from '@/lib/cart/storage'
import type { StoredCartItem } from '@/types/cart'

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
  hydrated: boolean
  itemCount: number
  addItem: (productId: string, quantity?: number) => void
  setQuantity: (productId: string, quantity: number) => void
  removeItem: (productId: string) => void
  clearCart: () => void
  syncValidatedItems: (items: StoredCartItem[]) => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], hydrated: false })

  useEffect(() => {
    dispatch({ type: 'HYDRATE', items: readStoredCart() })
  }, [])

  useEffect(() => {
    if (!state.hydrated) return
    writeStoredCart(state.items)
  }, [state.items, state.hydrated])

  const addItem = useCallback((productId: string, quantity = 1) => {
    dispatch({ type: 'ADD', productId, quantity })
  }, [])

  const setQuantity = useCallback((productId: string, quantity: number) => {
    dispatch({ type: 'SET_QUANTITY', productId, quantity })
  }, [])

  const removeItem = useCallback((productId: string) => {
    dispatch({ type: 'REMOVE', productId })
  }, [])

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR' })
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
      hydrated: state.hydrated,
      itemCount,
      addItem,
      setQuantity,
      removeItem,
      clearCart,
      syncValidatedItems,
    }),
    [
      state.items,
      state.hydrated,
      itemCount,
      addItem,
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
