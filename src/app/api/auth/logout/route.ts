import { NextRequest, NextResponse } from 'next/server'
import { jsonSuccess } from '@/lib/api/response'
import { copyCookies, createRouteHandlerClient } from '@/lib/supabase/route-handler'

export async function POST(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createRouteHandlerClient(request, response)

  await supabase.auth.signOut()

  const jsonResponse = jsonSuccess({ ok: true }, 'Logout realizado')
  copyCookies(response, jsonResponse)

  return jsonResponse
}
