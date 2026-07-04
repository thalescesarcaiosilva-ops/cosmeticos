import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/api/response'
import {
  isDuplicateSignup,
  isEmailConfirmFailure,
  logSignUpError,
  mapSignUpError,
} from '@/lib/auth/map-signup-error'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { copyCookies, createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { registerSchema } from '@/schemas/auth-schema'

function canBypassEmailConfirm(): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    process.env.SUPABASE_BYPASS_EMAIL_CONFIRM === 'true'
  )
}

async function createProfileIfMissing(userId: string, name: string) {
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
    })
    if (profileError) throw profileError
  } else {
    await admin.from('profiles').update({ name }).eq('id', userId)
  }
}

async function registerViaAdmin(
  email: string,
  password: string,
  name: string
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
    if (process.env.NODE_ENV === 'development') {
      console.error('[auth/register] admin.createUser', error.message)
    }
    return { error: 'Não foi possível criar a conta. Tente novamente.' }
  }

  if (!data.user) {
    return { error: 'Não foi possível criar a conta. Tente novamente.' }
  }

  try {
    await createProfileIfMissing(data.user.id, name.trim())
  } catch (profileError) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[auth/register] profile insert', profileError)
    }
    return {
      error: 'Erro no banco ao criar perfil. Execute PARTE_6_fix_signup.sql no Supabase.',
    }
  }

  return { userId: data.user.id }
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
  const { password } = parsed.data

  let response = NextResponse.next({ request })
  const supabase = createRouteHandlerClient(request, response)

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      logSignUpError(error)
    }

    if (isEmailConfirmFailure(error) && canBypassEmailConfirm()) {
      const adminResult = await registerViaAdmin(email, password, name)
      if ('error' in adminResult) {
        return jsonError(adminResult.error, 400)
      }

      const jsonResponse = NextResponse.json(
        {
          error: false,
          data: { ok: true, needsEmailConfirm: false, devBypass: true },
          message: 'Conta criada com sucesso (modo dev — confirmação de e-mail ignorada).',
        },
        { status: 200 }
      )
      copyCookies(response, jsonResponse)
      return jsonResponse
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
    await createProfileIfMissing(data.user.id, name)
  } catch (profileError) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[auth/register] profile insert', profileError)
    }
    return jsonError(
      'Erro no banco ao criar perfil. Execute PARTE_6_fix_signup.sql no Supabase.',
      400
    )
  }

  const needsEmailConfirm = !data.session

  const jsonResponse = NextResponse.json(
    {
      error: false,
      data: { ok: true, needsEmailConfirm },
      message: needsEmailConfirm
        ? 'Conta criada! Verifique seu e-mail para confirmar o cadastro.'
        : 'Conta criada com sucesso',
    },
    { status: 200 }
  )
  copyCookies(response, jsonResponse)

  return jsonResponse
}
