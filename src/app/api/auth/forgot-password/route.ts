import { NextRequest, NextResponse } from 'next/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { forgotPasswordSchema } from '@/schemas/auth-schema'

function getSiteOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  if (configured) return configured

  const origin = request.headers.get('origin')
  if (origin) return origin

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') ?? 'http'
  if (host) return `${proto}://${host}`

  return 'http://localhost:3000'
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rate = checkRateLimit(`auth:forgot:${ip}`, RATE_LIMITS.forgotPassword)

  if (!rate.allowed) {
    return jsonError('Muitas tentativas. Tente novamente em instantes.', 429, 'RATE_LIMIT')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = forgotPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Dados inválidos', 400)
  }

  const origin = getSiteOrigin(request)
  const redirectTo = `${origin}/auth/callback?next=/conta/redefinir-senha`

  let response = NextResponse.next({ request })
  const supabase = createRouteHandlerClient(request, response)

  await supabase.auth.resetPasswordForEmail(parsed.data.email.trim().toLowerCase(), {
    redirectTo,
  })

  return jsonSuccess(
    { ok: true },
    'Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.'
  )
}
