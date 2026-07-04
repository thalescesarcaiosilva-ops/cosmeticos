import { NextRequest, NextResponse } from 'next/server'
import { ensureUserProfile } from '@/lib/auth/ensure-profile'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { copyCookies, createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { sanitizeRedirectPath } from '@/lib/auth/safe-redirect'
import { loginSchema } from '@/schemas/auth-schema'

function resolveRedirect(role: 'admin' | 'customer', requested: string): string {
  const safe = sanitizeRedirectPath(requested, '/conta')
  if (safe.startsWith('/admin')) {
    return role === 'admin' ? safe : '/conta'
  }
  if (role === 'admin' && safe === '/conta') {
    return '/admin'
  }
  return safe
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rate = checkRateLimit(`auth:login:${ip}`, RATE_LIMITS.login)

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
    return jsonError('Dados inválidos', 400)
  }

  const requestedRedirect = sanitizeRedirectPath(
    typeof (body as { redirect?: string })?.redirect === 'string'
      ? (body as { redirect: string }).redirect
      : '/conta'
  )

  let response = NextResponse.next({ request })
  const supabase = createRouteHandlerClient(request, response)

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email.trim().toLowerCase(),
    password: parsed.data.password,
  })

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[auth/login]', error.message)
    }
    return jsonError('Email ou senha incorretos', 401)
  }

  if (!data.user) {
    return jsonError('Email ou senha incorretos', 401)
  }

  const displayName =
    (data.user.user_metadata?.name as string | undefined) ??
    data.user.email?.split('@')[0] ??
    'Usuário'

  const role = await ensureUserProfile(data.user.id, displayName)
  const redirectTo = resolveRedirect(role, requestedRedirect)

  const jsonResponse = jsonSuccess({ ok: true, role, redirectTo }, 'Login realizado')
  copyCookies(response, jsonResponse)

  return jsonResponse
}
