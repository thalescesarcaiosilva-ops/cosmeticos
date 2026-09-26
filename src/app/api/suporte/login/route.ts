import { NextRequest, NextResponse } from 'next/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { ensureUserProfile } from '@/lib/auth/ensure-profile'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { mapLoginError } from '@/lib/auth/map-login-error'
import { copyCookies, createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { loginSchema } from '@/schemas/auth-schema'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rate = checkRateLimit(`support:login:${ip}`, RATE_LIMITS.login)
  if (!rate.allowed) {
    return jsonError('Muitas tentativas. Tente novamente em instantes.', 429, 'RATE_LIMIT')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('E-mail ou senha incorretos', 401)
  }

  let response = NextResponse.next({ request })
  const supabase = createRouteHandlerClient(request, response)
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email.trim().toLowerCase(),
    password: parsed.data.password,
  })

  if (error || !data.user) {
    return jsonError(error ? mapLoginError(error) : 'E-mail ou senha incorretos', 401)
  }

  const displayName =
    (data.user.user_metadata?.name as string | undefined) ??
    data.user.email?.split('@')[0] ??
    'Suporte'
  const role = await ensureUserProfile(data.user.id, displayName)

  if (role !== 'support' && role !== 'admin') {
    await supabase.auth.signOut()
    const denied = jsonError('Acesso negado', 403, 'FORBIDDEN')
    copyCookies(response, denied)
    return denied
  }

  const jsonResponse = jsonSuccess({ ok: true, role, redirectTo: '/suporte' }, 'Login realizado')
  copyCookies(response, jsonResponse)
  return jsonResponse
}
