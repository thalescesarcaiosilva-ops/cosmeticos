import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/auth/verify-session'

export class OrderAccessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OrderAccessError'
  }
}

export async function assertOrderAccess(params: {
  orderId: string
  guestToken?: string | null
  userId?: string | null
}): Promise<void> {
  const admin = createAdminClient()
  const { data: order, error } = await admin
    .from('orders')
    .select('id, user_id, guest_access_token')
    .eq('id', params.orderId)
    .maybeSingle()

  if (error || !order) {
    throw new OrderAccessError('Pedido não encontrado')
  }

  if (params.userId && order.user_id === params.userId) {
    return
  }

  if (
    params.guestToken &&
    order.guest_access_token &&
    params.guestToken === order.guest_access_token
  ) {
    return
  }

  throw new OrderAccessError('Acesso negado ao pedido')
}

export async function getOptionalSessionUserId(): Promise<string | null> {
  const user = await getSessionUser()
  return user?.id ?? null
}

export function readGuestTokenFromRequest(request: Request): string | null {
  const header = request.headers.get('x-guest-order-token')?.trim()
  if (header) return header

  try {
    const url = new URL(request.url)
    const query = url.searchParams.get('token')?.trim()
    return query || null
  } catch {
    return null
  }
}
