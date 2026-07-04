import { NextRequest, NextResponse } from 'next/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { copyCookies, createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { passwordSchema } from '@/schemas/auth-schema'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rate = checkRateLimit(`auth:reset:${ip}`, RATE_LIMITS.login)

  if (!rate.allowed) {
    return jsonError('Muitas tentativas. Tente novamente em instantes.', 429, 'RATE_LIMIT')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = passwordSchema.safeParse((body as { password?: string })?.password)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Dados inválidos', 400)
  }

  let response = NextResponse.next({ request })
  const supabase = createRouteHandlerClient(request, response)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return jsonError('Sessão expirada. Solicite um novo link de recuperação.', 401)
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data })

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[auth/reset-password]', error.message)
    }
    return jsonError('Não foi possível alterar a senha. Tente novamente.', 400)
  }

  const jsonResponse = jsonSuccess({ ok: true }, 'Senha alterada com sucesso')
  copyCookies(response, jsonResponse)

  return jsonResponse
}
