import { NextRequest, NextResponse } from 'next/server'
import { claimGuestOrdersByEmail } from '@/lib/auth/claim-guest-orders'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import {
  isDuplicateSignup,
  logSignUpError,
  mapSignUpError,
  shouldFallbackToAdminSignup,
} from '@/lib/auth/map-signup-error'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { copyCookies, createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { registerSchema } from '@/schemas/auth-schema'

async function createProfileIfMissing(
  userId: string,
  name: string,
  phone?: string | null
) {
  const admin = createAdminClient()
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (!existingProfile) {
    const { error: profileError } = await admin.from('profiles').insert({
      id: userId,
      name,
      role: 'customer',
      phone: phone || null,
    })
    if (profileError) throw profileError
  } else {
    const updates: { name: string; phone?: string } = { name }
    if (phone) updates.phone = phone
    await admin.from('profiles').update(updates).eq('id', userId)
  }
}

async function claimOrdersAfterAuth(userId: string, email: string) {
  return claimGuestOrdersByEmail({ userId, email })
}

async function registerViaAdmin(
  email: string,
  password: string,
  name: string,
  phone?: string
): Promise<{ userId: string } | { error: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { name: name.trim() },
  })

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('already') || msg.includes('exists')) {
      return { error: 'Este e-mail já está cadastrado. Tente fazer login.' }
    }
    console.error('[auth/register] admin.createUser', error.message)
    return { error: 'Não foi possível criar a conta. Tente novamente.' }
  }

  if (!data.user) {
    return { error: 'Não foi possível criar a conta. Tente novamente.' }
  }

  try {
    await createProfileIfMissing(data.user.id, name.trim(), phone)
  } catch (profileError) {
    console.error('[auth/register] profile insert', profileError)
    return {
      error: 'Erro no banco ao criar perfil. Verifique a tabela profiles e o trigger handle_new_user.',
    }
  }

  return { userId: data.user.id }
}

async function signInRegisteredUser(
  request: NextRequest,
  response: NextResponse,
  email: string,
  password: string
) {
  const supabase = createRouteHandlerClient(request, response)
  return supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
}

async function registerSuccessResponse(
  response: NextResponse,
  options: {
    needsEmailConfirm: boolean
    signedIn: boolean
    claimedOrders?: number
    userId?: string
    email?: string
  }
) {
  let claimedOrders = options.claimedOrders ?? 0
  if (options.signedIn && options.userId && options.email && claimedOrders === 0) {
    claimedOrders = await claimOrdersAfterAuth(options.userId, options.email)
  }

  const redirectTo =
    options.signedIn && claimedOrders > 0 ? '/conta/pedidos' : options.signedIn ? '/conta' : undefined

  const message =
    options.signedIn && claimedOrders > 0
      ? `Conta criada! ${claimedOrders} pedido(s) vinculado(s).`
      : options.signedIn
        ? 'Conta criada com sucesso!'
        : options.needsEmailConfirm
          ? 'Conta criada! Verifique seu e-mail para confirmar o cadastro.'
          : 'Conta criada com sucesso'

  const jsonResponse = jsonSuccess(
    {
      ok: true,
      needsEmailConfirm: options.needsEmailConfirm,
      signedIn: options.signedIn,
      claimedOrders,
      redirectTo,
    },
    message
  )
  copyCookies(response, jsonResponse)
  return jsonResponse
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rate = checkRateLimit(`auth:register:${ip}`, RATE_LIMITS.register)

  if (!rate.allowed) {
    return jsonError('Muitas tentativas. Tente novamente em instantes.', 429, 'RATE_LIMIT')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? 'Dados inválidos'
    return jsonError(firstIssue, 400)
  }

  const email = parsed.data.email.trim().toLowerCase()
  const name = parsed.data.name.trim()
  const phone = parsed.data.phone
  const { password } = parsed.data

  let response = NextResponse.next({ request })
  const supabase = createRouteHandlerClient(request, response)

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })

  if (error) {
    logSignUpError(error)

    if (shouldFallbackToAdminSignup(error)) {
      const adminResult = await registerViaAdmin(email, password, name, phone)
      if ('error' in adminResult) {
        return jsonError(adminResult.error, 400)
      }

      const { error: signInError } = await signInRegisteredUser(
        request,
        response,
        email,
        password
      )

      if (signInError) {
        console.error('[auth/register] signIn after admin fallback', signInError.message)
        return registerSuccessResponse(response, {
          needsEmailConfirm: false,
          signedIn: false,
          userId: adminResult.userId,
          email,
        })
      }

      return registerSuccessResponse(response, {
        needsEmailConfirm: false,
        signedIn: true,
        userId: adminResult.userId,
        email,
      })
    }

    const status =
      error.message.toLowerCase().includes('rate limit') ||
      error.message.toLowerCase().includes('too many requests')
        ? 429
        : 400
    return jsonError(mapSignUpError(error), status)
  }

  if (isDuplicateSignup(data.user)) {
    return jsonError('Este e-mail já está cadastrado. Tente fazer login ou recuperar a senha.', 400)
  }

  if (!data.user) {
    return jsonError('Não foi possível criar a conta. Tente novamente.', 400)
  }

  try {
    await createProfileIfMissing(data.user.id, name, phone)
  } catch (profileError) {
    console.error('[auth/register] profile insert', profileError)
    return jsonError(
      'Erro no banco ao criar perfil. Verifique a tabela profiles e o trigger handle_new_user.',
      400
    )
  }

  const needsEmailConfirm = !data.session

  if (needsEmailConfirm) {
    const admin = createAdminClient()
    await admin.auth.admin.updateUserById(data.user.id, { email_confirm: true })

    const { error: signInError } = await signInRegisteredUser(
      request,
      response,
      email,
      password
    )

    if (!signInError) {
      return registerSuccessResponse(response, {
        needsEmailConfirm: false,
        signedIn: true,
        userId: data.user.id,
        email,
      })
    }

    console.error('[auth/register] signIn after confirm bypass', signInError.message)
  }

  return registerSuccessResponse(response, {
    needsEmailConfirm,
    signedIn: Boolean(data.session),
    userId: data.user.id,
    email,
  })
}
