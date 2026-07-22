import { createAdminClient } from '@/lib/supabase/admin'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Vincula pedidos guest (mesmo e-mail) à conta autenticada. */
export async function claimGuestOrdersByEmail(params: {
  userId: string
  email: string
}): Promise<number> {
  const email = normalizeEmail(params.email)
  if (!email) return 0

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('orders')
    .update({ user_id: params.userId })
    .is('user_id', null)
    .ilike('customer_email', email)
    .select('id')

  if (error) {
    console.error('[claim-guest-orders] by email', error.message)
    return 0
  }

  return data?.length ?? 0
}

/** Vincula um pedido específico usando o token de convidado. */
export async function claimGuestOrderByToken(params: {
  userId: string
  orderId: string
  guestToken: string
}): Promise<{ ok: true; email: string | null; name: string | null; phone: string | null } | { ok: false; reason: string }> {
  const admin = createAdminClient()
  const { data: order, error } = await admin
    .from('orders')
    .select('id, user_id, guest_access_token, customer_email, customer_name, customer_phone')
    .eq('id', params.orderId)
    .maybeSingle()

  if (error || !order) {
    return { ok: false, reason: 'ORDER_NOT_FOUND' }
  }

  if (order.user_id && order.user_id !== params.userId) {
    return { ok: false, reason: 'ORDER_OWNED' }
  }

  if (order.user_id === params.userId) {
    return {
      ok: true,
      email: order.customer_email,
      name: order.customer_name,
      phone: order.customer_phone,
    }
  }

  if (!order.guest_access_token || order.guest_access_token !== params.guestToken) {
    return { ok: false, reason: 'INVALID_TOKEN' }
  }

  const { error: updateError } = await admin
    .from('orders')
    .update({ user_id: params.userId })
    .eq('id', params.orderId)
    .is('user_id', null)

  if (updateError) {
    console.error('[claim-guest-orders] by token', updateError.message)
    return { ok: false, reason: 'UPDATE_FAILED' }
  }

  if (order.customer_email) {
    await claimGuestOrdersByEmail({
      userId: params.userId,
      email: order.customer_email,
    })
  }

  return {
    ok: true,
    email: order.customer_email,
    name: order.customer_name,
    phone: order.customer_phone,
  }
}

export async function syncProfileFromCheckout(params: {
  userId: string
  name?: string | null
  phone?: string | null
  cpf?: string | null
}): Promise<void> {
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, name, phone, cpf')
    .eq('id', params.userId)
    .maybeSingle()

  if (!profile) return

  const updates: Record<string, string> = {}
  const name = params.name?.trim()
  const phone = params.phone?.replace(/\D/g, '') || null
  const cpf = params.cpf?.replace(/\D/g, '') || null

  if (name && name.length >= 2 && (!profile.name || profile.name.trim().length < 2)) {
    updates.name = name
  }
  if (phone && phone.length >= 10 && !profile.phone) {
    updates.phone = phone
  }
  if (cpf && cpf.length === 11 && !profile.cpf) {
    updates.cpf = cpf
  }

  if (Object.keys(updates).length === 0) return

  await admin.from('profiles').update(updates).eq('id', params.userId)
}
