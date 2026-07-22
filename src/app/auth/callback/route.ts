import { NextRequest, NextResponse } from 'next/server'
import { sanitizeRedirectPath } from '@/lib/auth/safe-redirect'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const errorParam = searchParams.get('error')
  const errorCode = searchParams.get('error_code')
  const next = sanitizeRedirectPath(searchParams.get('next') ?? '/conta/redefinir-senha')

  // Erros vindos do verify do Supabase (query string)
  if (errorParam || errorCode === 'otp_expired') {
    const loginUrl = new URL('/conta/login', origin)
    loginUrl.searchParams.set('error', 'link_invalido')
    return NextResponse.redirect(loginUrl)
  }

  // Fluxo com token_hash (template novo) → página intermediária anti-prefetch
  if (tokenHash && type) {
    const recoverUrl = new URL('/auth/recuperar', origin)
    recoverUrl.searchParams.set('token_hash', tokenHash)
    recoverUrl.searchParams.set('type', type)
    recoverUrl.searchParams.set('next', next)
    return NextResponse.redirect(recoverUrl)
  }

  if (!code) {
    const loginUrl = new URL('/conta/login', origin)
    loginUrl.searchParams.set('error', 'link_invalido')
    return NextResponse.redirect(loginUrl)
  }

  let response = NextResponse.redirect(new URL(next, origin))
  const supabase = createRouteHandlerClient(request, response)

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[auth/callback]', error.message)
    }
    const loginUrl = new URL('/conta/login', origin)
    loginUrl.searchParams.set('error', 'link_invalido')
    return NextResponse.redirect(loginUrl)
  }

  return response
}
