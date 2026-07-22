import { type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sanitizeRedirectPath } from '@/lib/auth/safe-redirect'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'

const ALLOWED_TYPES = new Set<EmailOtpType>([
  'recovery',
  'signup',
  'invite',
  'magiclink',
  'email',
  'email_change',
])

function loginErrorRedirect(origin: string, code: string) {
  const url = new URL('/conta/login', origin)
  url.searchParams.set('error', code)
  return NextResponse.redirect(url)
}

async function confirmToken(request: NextRequest, tokenHash: string, type: string, nextPath: string) {
  const origin = new URL(request.url).origin
  const otpType = type as EmailOtpType

  if (!tokenHash || !ALLOWED_TYPES.has(otpType)) {
    return loginErrorRedirect(origin, 'link_invalido')
  }

  const next = sanitizeRedirectPath(
    nextPath || (otpType === 'recovery' ? '/conta/redefinir-senha' : '/conta')
  )

  let response = NextResponse.redirect(new URL(next, origin))
  const supabase = createRouteHandlerClient(request, response)

  const { error } = await supabase.auth.verifyOtp({
    type: otpType,
    token_hash: tokenHash,
  })

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[auth/confirm]', error.message, error.code)
    }
    return loginErrorRedirect(origin, 'link_invalido')
  }

  return response
}

/** Confirmação via POST (botão) — evita prefetch de e-mail consumir o token. */
export async function POST(request: NextRequest) {
  const form = await request.formData()
  const tokenHash = String(form.get('token_hash') ?? '')
  const type = String(form.get('type') ?? 'recovery')
  const next = String(form.get('next') ?? '')
  return confirmToken(request, tokenHash, type, next)
}

/** Fallback GET para links antigos com ?code= (PKCE). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') ?? 'recovery'
  const next = searchParams.get('next') ?? ''
  const code = searchParams.get('code')

  if (code) {
    let response = NextResponse.redirect(
      new URL(sanitizeRedirectPath(next || '/conta/redefinir-senha'), origin)
    )
    const supabase = createRouteHandlerClient(request, response)
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return loginErrorRedirect(origin, 'link_invalido')
    return response
  }

  if (!tokenHash) {
    return loginErrorRedirect(origin, 'link_invalido')
  }

  // GET direto ainda pode ser pré-buscado — preferir /auth/recuperar + POST.
  return confirmToken(request, tokenHash, type, next)
}
