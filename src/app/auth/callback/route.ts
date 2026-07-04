import { NextRequest, NextResponse } from 'next/server'
import { sanitizeRedirectPath } from '@/lib/auth/safe-redirect'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = sanitizeRedirectPath(searchParams.get('next'))

  if (!code) {
    return NextResponse.redirect(new URL('/conta/login', origin))
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
