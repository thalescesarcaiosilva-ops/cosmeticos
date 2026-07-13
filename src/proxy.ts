import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ACCOUNT_PATHS = [
  '/conta/login',
  '/conta/cadastro',
  '/conta/esqueci-senha',
  '/conta/redefinir-senha',
]

/**
 * URLs institucionais antigas -> novo padrão único (/paginas/*), usado por
 * todas as páginas institucionais e de políticas da loja. Redirecionamento
 * permanente (308) para preservar SEO de links e backlinks já indexados.
 */
const LEGACY_PAGE_REDIRECTS: Record<string, string> = {
  '/quem-somos': '/paginas/quem-somos',
  '/fale-conosco': '/paginas/fale-conosco',
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const legacyRedirect = LEGACY_PAGE_REDIRECTS[pathname]
  if (legacyRedirect) {
    const url = new URL(legacyRedirect, request.url)
    url.search = request.nextUrl.search
    return NextResponse.redirect(url, 308)
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAccountPublic = PUBLIC_ACCOUNT_PATHS.some((path) => pathname.startsWith(path))
  const isAccountArea = pathname.startsWith('/conta')
  const isAdminArea = pathname.startsWith('/admin')

  if (user && isAccountPublic && pathname !== '/conta/redefinir-senha') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const dest = profile?.role === 'admin' ? '/admin' : '/conta'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  if (isAccountArea && !isAccountPublic && !user) {
    const loginUrl = new URL('/conta/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAdminArea) {
    if (!user) {
      const loginUrl = new URL('/conta/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role !== 'admin') {
      const loginUrl = new URL('/conta/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      loginUrl.searchParams.set('error', 'admin_required')
      return NextResponse.redirect(loginUrl)
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
