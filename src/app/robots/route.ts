import { NextRequest, NextResponse } from 'next/server'

/** Atalho: /robots → /robots.txt (evita cair em /[brandSlug]). */
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/robots.txt', request.url), 308)
}
