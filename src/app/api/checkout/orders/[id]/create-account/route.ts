import { NextRequest, NextResponse } from 'next/server'
import { claimGuestOrderByToken, syncProfileFromCheckout } from '@/lib/auth/claim-guest-orders'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { copyCookies, createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { createAccountFromOrderSchema } from '@/schemas/auth-schema'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await context.params
  const ip = getClientIp(request)
  const rate = checkRateLimit(`auth:order-claim:${ip}`, RATE_LIMITS.register)

  if (!rate.allowed) {
    return jsonError('Muitas tentativas. Tente novamente em instantes.', 429, 'RATE_LIMIT')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = createAccountFromOrderSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Dados inválidos', 400)
  }

  const admin = createAdminClient()
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id, user_id, guest_access_token, customer_email, customer_name, customer_phone, customer_document')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError || !order) {
    return jsonError('Pedido não encontrado', 404, 'ORDER_NOT_FOUND')
  }

  if (order.user_id) {
    return jsonError(
      'Este pedido já está vinculado a uma conta. Faça login para acompanhar.',
      400,
      'ORDER_OWNED'
    )
  }

  if (!order.guest_access_token || order.guest_access_token !== parsed.data.guestToken) {
    return jsonError('Não foi possível validar o acesso a este pedido.', 403, 'INVALID_TOKEN')
  }

  const email = order.customer_email?.trim().toLowerCase()
  const name = order.customer_name?.trim() || email?.split('@')[0] || 'Cliente'

  if (!email) {
    return jsonError('Pedido sem e-mail. Não é possível criar a conta.', 400)
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { name },
  })

  if (createError || !created.user) {
    const msg = (createError?.message ?? '').toLowerCase()
    if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
      return jsonError(
        'Este e-mail já possui conta. Faça login para ver seus pedidos.',
        400,
        'EMAIL_EXISTS'
      )
    }
    console.error('[create-account-from-order]', createError?.message)
    return jsonError('Não foi possível criar a conta. Tente novamente.', 400)
  }

  const userId = created.user.id

  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (!existingProfile) {
    await admin.from('profiles').insert({
      id: userId,
      name,
      role: 'customer',
      phone: order.customer_phone ?? null,
      cpf: order.customer_document ?? null,
    })
  } else {
    await syncProfileFromCheckout({
      userId,
      name,
      phone: order.customer_phone,
      cpf: order.customer_document,
    })
  }

  const claimed = await claimGuestOrderByToken({
    userId,
    orderId,
    guestToken: parsed.data.guestToken,
  })

  if (!claimed.ok) {
    console.error('[create-account-from-order] claim failed', claimed.reason)
  }

  let response = NextResponse.next({ request })
  const supabase = createRouteHandlerClient(request, response)
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  })

  if (signInError) {
    console.error('[create-account-from-order] signIn', signInError.message)
    return jsonSuccess(
      { ok: true, signedIn: false, redirectTo: '/conta/login?redirect=/conta/pedidos' },
      'Conta criada! Faça login para ver seus pedidos.'
    )
  }

  const jsonResponse = jsonSuccess(
    { ok: true, signedIn: true, redirectTo: '/conta/pedidos' },
    'Conta criada! Seu pedido já aparece em Minha conta.'
  )
  copyCookies(response, jsonResponse)
  return jsonResponse
}
