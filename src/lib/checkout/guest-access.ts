export const GUEST_ORDER_TOKEN_PREFIX = 'guest-order:'

export function guestOrderStorageKey(orderId: string): string {
  return `${GUEST_ORDER_TOKEN_PREFIX}${orderId}`
}

export function readGuestOrderToken(orderId: string): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(guestOrderStorageKey(orderId))
}

export function storeGuestOrderToken(orderId: string, token: string): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(guestOrderStorageKey(orderId), token)
}

export function clearGuestOrderToken(orderId: string): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(guestOrderStorageKey(orderId))
}

export function guestOrderHeaders(orderId: string): HeadersInit {
  const token = readGuestOrderToken(orderId)
  if (!token) return {}
  return { 'X-Guest-Order-Token': token }
}

export function guestOrderQuery(orderId: string): string {
  const token = readGuestOrderToken(orderId)
  if (!token) return ''
  return `?token=${encodeURIComponent(token)}`
}
