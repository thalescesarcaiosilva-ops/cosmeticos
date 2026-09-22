/**
 * Persistência client-side do Pix em andamento (localStorage).
 *
 * Objetivo: sobreviver a reload/troca de aba sem perder a tela do QR nem
 * criar um pedido duplicado — e ainda permitir que o cliente volte à loja
 * e comece um pedido novo (ex.: mais caro) enquanto o Pix anterior continua
 * válido e pagável pelo link salvo no histórico.
 *
 * Nunca é fonte da verdade: todo restore deve ser revalidado no servidor
 * (ver payment-status) antes de exibir qualquer coisa ao cliente.
 */

export type ActivePixPayload = {
  orderId: string
  guestToken: string | null
  total: number
  discountAmount: number
  qrCode: string | null
  qrImage: string | null
  expiresAt: string | null
  createdAt: string
}

export type PendingOrderEntry = {
  orderId: string
  guestToken: string | null
  total: number
  expiresAt: string | null
  createdAt: string
}

const ACTIVE_KEY = 'bc_checkout_active_pix_v1'
const HISTORY_KEY = 'bc_checkout_pending_orders_v1'
const MAX_HISTORY = 5
/** Janela de tolerância além do expiresAt informado pelo gateway. */
const EXPIRY_GRACE_MS = 2 * 60 * 1000

function hasWindow(): boolean {
  return typeof window !== 'undefined'
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function isLocallyExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false
  const t = Date.parse(expiresAt)
  if (Number.isNaN(t)) return false
  return Date.now() > t + EXPIRY_GRACE_MS
}

export function saveActivePix(payload: ActivePixPayload): void {
  if (!hasWindow()) return
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(payload))
  } catch {
    // storage indisponível (modo privado etc.) — segue sem persistir
  }
}

export function readActivePix(): ActivePixPayload | null {
  if (!hasWindow()) return null
  return safeParse<ActivePixPayload>(localStorage.getItem(ACTIVE_KEY))
}

export function clearActivePix(): void {
  if (!hasWindow()) return
  try {
    localStorage.removeItem(ACTIVE_KEY)
  } catch {
    // ignore
  }
}

function readHistoryRaw(): PendingOrderEntry[] {
  if (!hasWindow()) return []
  return safeParse<PendingOrderEntry[]>(localStorage.getItem(HISTORY_KEY)) ?? []
}

function writeHistory(entries: PendingOrderEntry[]): void {
  if (!hasWindow()) return
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
  } catch {
    // ignore
  }
}

/** Remove expirados/antigos e devolve a lista utilizável (mais recente primeiro). */
export function listPendingOrders(): PendingOrderEntry[] {
  const pruned = readHistoryRaw().filter((entry) => !isLocallyExpired(entry.expiresAt))
  writeHistory(pruned)
  return [...pruned].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
  )
}

export function pushPendingOrder(entry: PendingOrderEntry): void {
  const current = readHistoryRaw().filter((item) => item.orderId !== entry.orderId)
  current.unshift(entry)
  writeHistory(current.slice(0, MAX_HISTORY))
}

export function removePendingOrder(orderId: string): void {
  const current = readHistoryRaw().filter((item) => item.orderId !== orderId)
  writeHistory(current)
}

export function pendingOrderUrl(entry: PendingOrderEntry): string {
  const query = entry.guestToken ? `?token=${encodeURIComponent(entry.guestToken)}` : ''
  return `/pedido/${entry.orderId}/obrigado${query}`
}
