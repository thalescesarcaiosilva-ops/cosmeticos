import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { createFooterPageSchema } from '@/schemas/footer-page-schema'

const FOOTER_PAGE_COLUMNS =
  'id, slug, title, content, page_type, sort_order, show_in_footer, meta_description, active, created_at, updated_at'

async function requireAdmin() {
  try {
    return await requireAdminUser()
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return jsonError('Não autorizado', 401, 'UNAUTHORIZED')
    }
    if (e instanceof Error && e.message === 'FORBIDDEN') {
      return jsonError('Acesso negado', 403, 'FORBIDDEN')
    }
    return jsonError('Erro interno', 500)
  }
}

export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('footer_pages')
    .select(FOOTER_PAGE_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true })

  if (error) {
    return jsonError('Não foi possível carregar as páginas do rodapé', 500)
  }

  return jsonSuccess(data ?? [])
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = createFooterPageSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Dados inválidos', 400)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('footer_pages')
    .insert(parsed.data)
    .select(FOOTER_PAGE_COLUMNS)
    .single()

  if (error || !data) {
    return jsonError('Não foi possível criar a página do rodapé', 400)
  }

  revalidateTag('site-layout', 'max')

  return jsonSuccess(data, 'Página do rodapé criada', 201)
}
